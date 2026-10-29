import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { errorResponse, parseBody, rateLimited } from "@/lib/api";
import { assistantProvider, getConversation, MAX_MESSAGE_CHARS, routeAssistantPrompt, runAssistant, TOOLS } from "@/lib/ai/assistant";
import { verifySolution } from "@/lib/ai/pow";
import type { AssistantEvent } from "@/lib/ai/types";
import { GUEST_LIMITS } from "@/lib/guest";
import { RateLimiter, clientIp } from "@/lib/rate-limit";
import { requestContext } from "@/lib/request-context";
import { latLng, fitness, rideProfile } from "@/lib/routing/schema";
import { RoutingError } from "@/lib/routing/types";

export const dynamic = "force-dynamic";

const body = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
  context: z.object({
    waypoints: z.array(z.object({ label: z.string().max(200).optional(), point: latLng })).max(25),
    profile: rideProfile,
    fitness,
  }),
  pow: z.object({ challenge: z.string().max(200), nonce: z.string().max(16) }).optional(),
});

const perMinute = new RateLimiter(Number(process.env.AI_MESSAGES_PER_MIN ?? 6), 60_000);
const guestDaily = new RateLimiter(GUEST_LIMITS.aiMessagesPerDay, 24 * 60 * 60 * 1000);
const memberDaily = new RateLimiter(GUEST_LIMITS.memberAiMessagesPerDay, 24 * 60 * 60 * 1000);

function friendlyError(error: unknown): { code: string; message: string } {
  if (error instanceof RoutingError) return { code: error.code, message: error.message };
  if (error instanceof Anthropic.RateLimitError) return { code: "busy", message: "The assistant is busy right now. Try again in a minute." };
  if (error instanceof Anthropic.AuthenticationError) return { code: "unavailable", message: "The assistant isn't configured on this server." };
  if (error instanceof Anthropic.APIConnectionError) return { code: "unavailable", message: "The assistant can't be reached right now." };
  if (error instanceof Anthropic.APIError) {
    return (error.status ?? 0) >= 500
      ? { code: "busy", message: "The assistant is overloaded. Try again shortly." }
      : { code: "internal", message: "The assistant couldn't handle that request." };
  }
  if (error instanceof TypeError) return { code: "unavailable", message: "The assistant can't be reached right now." };
  return { code: "internal", message: "Something went wrong. Try again." };
}

/** POST /api/assistant — one rider message; answers as server-sent events (see AssistantEvent). */
export async function POST(request: Request) {
  try {
    const input = await parseBody(request, body);
    const ctx = await requestContext();
    const ip = clientIp(request);
    const owner = ctx.sessionKey ?? `ip:${ip}`;
    // Eval runs (evals/run.ts) skip quotas and the bot check, only when the server has AI_EVAL_TOKEN set.
    const evalToken = process.env.AI_EVAL_TOKEN;
    const isEval = Boolean(evalToken && evalToken.length >= 16 && request.headers.get("x-eval-token") === evalToken);

    const minute = isEval ? { ok: true, resetAt: 0 } : perMinute.take(`ip:${ip}`);
    if (!minute.ok) return rateLimited(Math.ceil((minute.resetAt - Date.now()) / 1000));

    const provider = assistantProvider();
    const conversation = getConversation(
      input.conversationId,
      owner,
      () => provider.createSession(routeAssistantPrompt(), TOOLS),
      input.context,
    );
    const isNew = conversation.state.id !== input.conversationId;

    // Guests prove they're a browser (invisible proof of work) when starting a conversation.
    if (!isEval && ctx.isGuest && isNew && !(input.pow && verifySolution(input.pow.challenge, input.pow.nonce))) {
      throw new RoutingError("invalid_request", "Please reload the page and try again.");
    }
    const daily = isEval ? { ok: true } : (ctx.isGuest ? guestDaily : memberDaily).take(owner);
    if (!daily.ok) {
      return errorResponse(
        new RoutingError(
          "rate_limited",
          ctx.isGuest
            ? `That's today's ${GUEST_LIMITS.aiMessagesPerDay} assistant messages for the demo. A free account gets ${GUEST_LIMITS.memberAiMessagesPerDay} a day.`
            : "That's today's assistant limit. It resets in 24 hours.",
        ),
      );
    }

    const abort = new AbortController();
    request.signal.addEventListener("abort", () => abort.abort());
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (event: AssistantEvent) => {
          if (abort.signal.aborted) return;
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
        };
        emit({ type: "start", conversationId: conversation.state.id, provider: provider.name.split(":")[0] });
        try {
          await runAssistant({
            conversation,
            message: input.message,
            context: input.context,
            toolContext: { isGuest: ctx.isGuest, accessToken: ctx.accessToken },
            emit,
            signal: abort.signal,
          });
        } catch (error) {
          if (!abort.signal.aborted) {
            console.error(JSON.stringify({ at: "assistant", provider: provider.name, error: (error as Error).message }));
            emit({ type: "error", ...friendlyError(error) });
          }
        } finally {
          try {
            controller.close();
          } catch {
            // Already closed by a cancelled client.
          }
        }
      },
      cancel() {
        abort.abort();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
