import type { ToolSpec } from "../tools";
import type { ToolCall } from "../types";

export type StopKind = "end" | "tool_use" | "max_tokens" | "refusal" | "other";

export interface ModelTurn {
  text: string;
  toolCalls: ToolCall[];
  stop: StopKind;
}

/**
 * One conversation with a model. The history lives inside the session and is append-only:
 * every turn the model produced is kept exactly as it came back.
 */
export interface ModelSession {
  addUser(text: string): void;
  step(onText: (delta: string) => void, signal: AbortSignal): Promise<ModelTurn>;
  addToolResults(results: { id: string; content: string; isError?: boolean }[]): void;
}

export interface AssistantProvider {
  readonly name: string;
  createSession(system: string, tools: ToolSpec[]): ModelSession;
}
