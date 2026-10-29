import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { ToolSpec } from "../tools";
import type { AssistantProvider, ModelSession, ModelTurn } from "./types";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/** Claude via the Messages API (streaming, client tools, server-side refusal fallback). */
export function createAnthropicProvider({
  model = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5",
  maxTokens = Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 8000),
  effort = (process.env.ANTHROPIC_EFFORT as Effort | undefined) ?? "medium",
}: { model?: string; maxTokens?: number; effort?: Effort } = {}): AssistantProvider {
  // Reads ANTHROPIC_API_KEY (or another configured credential) from the server environment.
  const client = new Anthropic();

  return {
    name: `anthropic:${model}`,
    createSession(system: string, specs: ToolSpec[]): ModelSession {
      const tools: Anthropic.Beta.BetaTool[] = specs.map((spec) => ({
        name: spec.name,
        description: spec.description,
        input_schema: spec.jsonSchema as Anthropic.Beta.BetaTool.InputSchema,
        // Inputs stream as generated; every input is validated against the zod schema before it runs.
        eager_input_streaming: true,
      }));
      const messages: Anthropic.Beta.BetaMessageParam[] = [];

      return {
        addUser(text) {
          messages.push({ role: "user", content: text });
        },

        async step(onText, signal): Promise<ModelTurn> {
          let jsonRetries = 0;
          for (;;) {
            const stream = client.beta.messages.stream(
              {
                model,
                max_tokens: maxTokens,
                system,
                tools,
                messages,
                output_config: { effort },
                // Cache the stable prefix (tools + system + earlier turns) across the loop.
                cache_control: { type: "ephemeral" },
                // On a safety decline, the API re-runs the request on Anthropic's recommended fallback model.
                fallbacks: "default",
                betas: ["server-side-fallback-2026-07-01"],
              },
              { signal },
            );
            stream.on("text", onText);

            let message: Anthropic.Beta.BetaMessage;
            try {
              message = await stream.finalMessage();
            } catch (error) {
              // Only an unparseable streamed tool input is retried; API errors and aborts propagate.
              if (error instanceof Anthropic.APIError || signal.aborted || jsonRetries++ >= 2) throw error;
              continue;
            }

            // Append the assistant turn exactly as returned (thinking blocks included).
            messages.push({ role: "assistant", content: message.content as Anthropic.Beta.BetaContentBlockParam[] });

            const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
            if (message.stop_reason === "refusal") return { text, toolCalls: [], stop: "refusal" };
            const toolCalls = message.content.flatMap((b) =>
              b.type === "tool_use" ? [{ id: b.id, name: b.name, input: b.input }] : [],
            );
            // A tool input cut off at max_tokens may parse as a valid but truncated object: never run it.
            if (message.stop_reason === "max_tokens") return { text, toolCalls: [], stop: "max_tokens" };
            if (toolCalls.length) return { text, toolCalls, stop: "tool_use" };
            return { text, toolCalls: [], stop: message.stop_reason === "end_turn" ? "end" : "other" };
          }
        },

        addToolResults(results) {
          // All results for one assistant turn go back in a single user message.
          messages.push({
            role: "user",
            content: results.map((r) => ({
              type: "tool_result" as const,
              tool_use_id: r.id,
              content: r.content,
              ...(r.isError ? { is_error: true } : {}),
            })),
          });
        },
      };
    },
  };
}
