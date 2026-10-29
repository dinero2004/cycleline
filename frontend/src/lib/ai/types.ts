import type { Fitness, LatLng, RankedRoute, RideProfile } from "@/lib/routing/types";

/** Events streamed to the browser over SSE. */
export type AssistantEvent =
  | { type: "start"; conversationId: string; provider: string }
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; status: "running" | "done" | "error"; label: string }
  | { type: "routes"; routes: RouteCard[] }
  | { type: "signup"; reason: "save" | "quota" }
  | { type: "error"; code: string; message: string }
  | { type: "done"; usage?: { toolCalls: number } };

/** What the chat shows for one candidate; `route` is drawn on the map when the rider picks it. */
export interface RouteCard {
  rank: number;
  title: string;
  why: string;
  route: RankedRoute;
}

export interface Place {
  id: string;
  name: string;
  label: string;
  point: LatLng;
}

export interface StudioContext {
  waypoints: { label?: string; point: LatLng }[];
  profile: RideProfile;
  fitness: Fitness;
}

/** Server-side conversation state: places and routes the tools produced, referenced by id. */
export interface ConversationState {
  id: string;
  owner: string;
  places: Map<string, Place>;
  routes: Map<string, RankedRoute>;
  /** Rank of each route within the batch it was planned in ("option 2"). */
  ranks: Map<string, number>;
  placeCounter: number;
  /** Number of geocode calls so far; the n-th call's best match is p{n}. */
  geocodeCount: number;
  /** Ids of the most recent batch of options, in rank order ("option 2" → index 1). */
  lastBatch: string[];
  fitness: Fitness;
  profile: RideProfile;
  /** Everything the rider wrote (lower-cased): place names the model passes must come from here or a tool. */
  riderText: string;
  /** Numbers the tools returned, as text; used to check the reply for invented coordinates. */
  toolNumbers: Set<string>;
  updatedAt: number;
}

export interface ToolContext {
  state: ConversationState;
  isGuest: boolean;
  accessToken: string | null;
  signal: AbortSignal;
  emit: (event: AssistantEvent) => void;
}

export interface ToolResult {
  content: string;
  isError?: boolean;
}

/** A tool call as the model sent it, before validation. */
export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}
