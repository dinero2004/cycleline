import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { redactCoordinates, rememberNumbers, cleanName } from "./guard";
import { createAnthropicProvider } from "./providers/anthropic";
import { createOpenAICompatibleProvider } from "./providers/openai-compatible";
import type { AssistantProvider, ModelSession } from "./providers/types";
import { runTool, TOOLS } from "./tools";
import type { AssistantEvent, ConversationState, StudioContext, ToolCall, ToolContext } from "./types";

export const MAX_MESSAGE_CHARS = 1000;
const MAX_STEPS = Number(process.env.AI_MAX_STEPS ?? 6);
const MAX_TOOL_CALLS = Number(process.env.AI_MAX_TOOL_CALLS ?? 8);
const CONVERSATION_TTL_MS = 60 * 60 * 1000;
const MAX_CONVERSATIONS = 500;

let systemPrompt: string | null = null;
/** prompts/route-assistant.md, read once (bundled via outputFileTracingIncludes). */
export function routeAssistantPrompt(): string {
  systemPrompt ??= readFileSync(join(process.cwd(), "prompts", "route-assistant.md"), "utf8");
  return systemPrompt;
}

let provider: AssistantProvider | null = null;
/** AI_PROVIDER=anthropic | openai (any OpenAI-compatible server, e.g. Ollama with Llama). */
export function assistantProvider(): AssistantProvider {
  if (!provider) {
    const choice = process.env.AI_PROVIDER ?? (process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai");
    provider = choice === "anthropic" ? createAnthropicProvider() : createOpenAICompatibleProvider();
  }
  return provider;
}

interface Conversation {
  state: ConversationState;
  session: ModelSession;
  busy: boolean;
}

const conversations = new Map<string, Conversation>();

/** Existing conversation for this owner, or a new one. Kept in memory for an hour. */
export function getConversation(id: string | undefined, owner: string, make: () => ModelSession, context: StudioContext): Conversation {
  const now = Date.now();
  for (const [key, c] of conversations) if (now - c.state.updatedAt > CONVERSATION_TTL_MS) conversations.delete(key);
  const existing = id ? conversations.get(id) : undefined;
  if (existing && existing.state.owner === owner) return existing;
  while (conversations.size >= MAX_CONVERSATIONS) conversations.delete(conversations.keys().next().value as string);
  const conversation: Conversation = {
    state: {
      id: crypto.randomUUID(),
      owner,
      places: new Map(),
      routes: new Map(),
      ranks: new Map(),
      placeCounter: 0,
      geocodeCount: 0,
      lastBatch: [],
      fitness: context.fitness,
      profile: context.profile,
      riderText: "",
      toolNumbers: new Set(),
      updatedAt: now,
    },
    session: make(),
    busy: false,
  };
  conversations.set(conversation.state.id, conversation);
  return conversation;
}

/** Registers the studio's current waypoints as places current_1…n and renders the context block. */
function contextBlock(state: ConversationState, context: StudioContext): string {
  for (const key of [...state.places.keys()]) if (key.startsWith("current_")) state.places.delete(key);
  const waypoints = context.waypoints.slice(0, 25).map((w, i) => {
    const id = `current_${i + 1}`;
    const name = cleanName(w.label ?? (i === 0 ? "Start" : i === context.waypoints.length - 1 ? "Finish" : `Waypoint ${i + 1}`), 80);
    state.places.set(id, { id, name, label: name, point: w.point });
    return { place_id: id, name };
  });
  state.fitness = context.fitness;
  state.profile = context.profile;
  const today = new Date().toISOString().slice(0, 10);
  return `<studio_context>${JSON.stringify({ today, waypoints, ride_profile: context.profile, rider_fitness: context.fitness })}</studio_context>`;
}

/** Route and place ids are for tools; riders see "option 2" or the place name instead. */
export function hideIds(text: string, state: ConversationState): string {
  return text
    .replace(/\br_[a-z0-9]{3,13}\b/g, (id) => (state.ranks.has(id) ? `option ${state.ranks.get(id)}` : "that route"))
    .replace(/\b(p\d{1,4}|current_\d{1,2})\b/g, (id) => state.places.get(id)?.name ?? "that place");
}

/**
 * Text is streamed in pieces; a coordinate can straddle two pieces. Hold back a trailing
 * number-ish tail until the next piece (or the end) and redact invented coordinates.
 */
function coordinateSafeStream(emit: (e: AssistantEvent) => void, state: ConversationState) {
  const sourced = state.toolNumbers;
  let pending = "";
  return {
    push(delta: string) {
      pending += delta;
      const cut = pending.search(/[-\w.]*$/);
      const ready = pending.slice(0, cut);
      pending = pending.slice(cut);
      if (ready) emit({ type: "text", delta: hideIds(redactCoordinates(ready, sourced), state) });
    },
    flush() {
      if (pending) emit({ type: "text", delta: hideIds(redactCoordinates(pending, sourced), state) });
      pending = "";
    },
  };
}

/** Runs one rider message through the model ⇄ tools loop, streaming events. */
export async function runAssistant({
  conversation,
  message,
  context,
  toolContext,
  emit,
  signal,
}: {
  conversation: Conversation;
  message: string;
  context: StudioContext;
  toolContext: Omit<ToolContext, "state" | "emit" | "signal">;
  emit: (event: AssistantEvent) => void;
  signal: AbortSignal;
}) {
  if (conversation.busy) {
    emit({ type: "error", code: "busy", message: "Still answering your last message." });
    return;
  }
  conversation.busy = true;
  const { state, session } = conversation;
  state.updatedAt = Date.now();
  const ctx: ToolContext = { ...toolContext, state, emit, signal };
  let toolCalls = 0;

  async function callTool(call: ToolCall, count: number): Promise<{ content: string; isError?: boolean }> {
    if (count > MAX_TOOL_CALLS) {
      return { content: JSON.stringify({ error: "Tool budget for this answer is used up. Answer with what you have." }), isError: true };
    }
    try {
      const result = await runTool(call.name, call.input, ctx);
      rememberNumbers(state.toolNumbers, result.content);
      return result;
    } catch (error) {
      if ((error as Error).name !== "AbortError" && !signal.aborted) throw error;
      // Cancelled: still answer every tool call so the history stays valid for the next message.
      return { content: JSON.stringify({ error: "Cancelled by the rider." }), isError: true };
    }
  }

  try {
    state.riderText += ` ${message.toLowerCase()}`;
    session.addUser(`${contextBlock(state, context)}\n\n${message.slice(0, MAX_MESSAGE_CHARS)}`);
    for (let step = 0; step < MAX_STEPS; step++) {
      const out = coordinateSafeStream(emit, state);
      const turn = await session.step((delta) => out.push(delta), signal);
      out.flush();

      if (turn.stop === "refusal") {
        emit({ type: "text", delta: "\n\nI can't help with that request. I can plan rides, compare routes and check conditions." });
        break;
      }
      if (turn.stop === "max_tokens") {
        emit({ type: "text", delta: "\n\n(That answer hit the length limit. Ask me to continue or narrow it down.)" });
        break;
      }
      if (turn.stop !== "tool_use") break;

      // Run in order: models often geocode and plan in the same turn, and planning needs the places first.
      const results: { id: string; content: string; isError?: boolean }[] = [];
      for (const call of turn.toolCalls) results.push({ id: call.id, ...(await callTool(call, ++toolCalls)) });
      session.addToolResults(results);
      if (signal.aborted) break;
      if (step === MAX_STEPS - 1) {
        emit({ type: "text", delta: "\n\n(I stopped there to keep this quick. Ask a follow-up to go further.)" });
      }
    }
    emit({ type: "done", usage: { toolCalls } });
  } finally {
    conversation.busy = false;
    state.updatedAt = Date.now();
  }
}

export { TOOLS };
