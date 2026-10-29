import "server-only";

import type { ToolSpec } from "../tools";
import type { AssistantProvider, ModelSession, ModelTurn, StopKind } from "./types";

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

interface Delta {
  content?: string | null;
  tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[];
}

/** `{"name": "plan_loop", "parameters": {...}}` written as text → a tool call, when the name is a real tool. */
export function parseInlineToolCall(text: string, specs: ToolSpec[]): { name: string; args: unknown } | null {
  try {
    const value = JSON.parse(text.trim()) as { name?: unknown; parameters?: unknown; arguments?: unknown };
    if (typeof value.name !== "string" || !specs.some((spec) => spec.name === value.name)) return null;
    return { name: value.name, args: value.parameters ?? value.arguments ?? {} };
  } catch {
    return null;
  }
}

/**
 * Llama (or any model) behind an OpenAI-compatible chat completions API: Ollama, vLLM, Together…
 * Configured with AI_OPENAI_BASE_URL, AI_OPENAI_MODEL and optionally AI_OPENAI_API_KEY.
 */
export function createOpenAICompatibleProvider({
  baseUrl = process.env.AI_OPENAI_BASE_URL ?? "http://127.0.0.1:11434/v1",
  model = process.env.AI_OPENAI_MODEL ?? "llama3.1",
  apiKey = process.env.AI_OPENAI_API_KEY,
  maxTokens = Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 2000),
}: { baseUrl?: string; model?: string; apiKey?: string; maxTokens?: number } = {}): AssistantProvider {
  return {
    name: `openai-compatible:${model}`,
    createSession(system: string, specs: ToolSpec[]): ModelSession {
      const tools = specs.map((spec) => ({
        type: "function" as const,
        function: { name: spec.name, description: spec.description, parameters: spec.jsonSchema },
      }));
      const messages: ChatMessage[] = [{ role: "system", content: system }];

      return {
        addUser(text) {
          messages.push({ role: "user", content: text });
        },

        async step(onText, signal): Promise<ModelTurn> {
          const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            signal,
            headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
            body: JSON.stringify({ model, messages, tools, stream: true, max_tokens: maxTokens, temperature: 0.2 }),
          });
          if (!response.ok || !response.body) {
            throw new Error(`Model server answered ${response.status}.`);
          }

          let text = "";
          // Small models sometimes write a tool call as JSON text instead of using tool_calls.
          // Text that starts with "{" is held back until the end and checked before it is shown.
          let held = false;
          let finish: string | null = null;
          const calls: { id: string; name: string; args: string }[] = [];
          const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
          let buffer = "";
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              const data = line.replace(/^data:\s*/, "").trim();
              if (!data || data === "[DONE]" || !line.startsWith("data:")) continue;
              const chunk = JSON.parse(data) as { choices?: { delta?: Delta; finish_reason?: string | null }[] };
              const choice = chunk.choices?.[0];
              if (!choice) continue;
              if (choice.delta?.content) {
                text += choice.delta.content;
                if (!held && text.trimStart().startsWith("{")) held = true;
                if (!held) onText(choice.delta.content);
              }
              for (const call of choice.delta?.tool_calls ?? []) {
                const slot = (calls[call.index] ??= { id: call.id ?? `call_${call.index}`, name: "", args: "" });
                if (call.id) slot.id = call.id;
                if (call.function?.name) slot.name += call.function.name;
                if (call.function?.arguments) slot.args += call.function.arguments;
              }
              if (choice.finish_reason) finish = choice.finish_reason;
            }
          }

          if (held && !calls.length) {
            const inline = parseInlineToolCall(text, specs);
            if (inline) {
              calls.push({ id: `inline_${Date.now().toString(36)}`, name: inline.name, args: JSON.stringify(inline.args) });
              text = "";
            } else {
              onText(text);
            }
          }

          messages.push({
            role: "assistant",
            content: text || null,
            ...(calls.length
              ? { tool_calls: calls.map((c) => ({ id: c.id, type: "function" as const, function: { name: c.name, arguments: c.args || "{}" } })) }
              : {}),
          });

          const toolCalls = calls.map((c) => {
            let input: unknown = undefined;
            try {
              input = c.args ? JSON.parse(c.args) : {};
            } catch {
              // Left undefined: schema validation turns it into an error result the model can fix.
            }
            return { id: c.id, name: c.name, input };
          });
          const stop: StopKind = finish === "length" ? "max_tokens" : toolCalls.length ? "tool_use" : finish === "stop" ? "end" : "other";
          return { text, toolCalls: stop === "max_tokens" ? [] : toolCalls, stop };
        },

        addToolResults(results) {
          for (const r of results) messages.push({ role: "tool", tool_call_id: r.id, content: r.content });
        },
      };
    },
  };
}
