import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/brouter-zurich-baden.json";
import { grade } from "../evals/grade";
import { parseBRouter } from "@/lib/routing/providers/brouter";
import { rankRoutes } from "@/lib/routing/scoring";

const baseRoute = parseBRouter(
  fixture as never,
  { waypoints: [[47.3846, 8.5313], [47.4733, 8.3065]], profile: "road", preferences: {}, alternative: 0 },
  "t",
);
const ranked = rankRoutes([baseRoute, { ...baseRoute, id: "r_alt2", distanceM: baseRoute.distanceM + 4000 }], {
  fitness: "intermediate",
  preferences: {},
});

const geocodeCalls: string[] = [];
vi.mock("@/lib/geocode", () => ({
  searchPlaces: async (query: string) => {
    geocodeCalls.push(query);
    return [{ name: "Zürich", label: "Zürich, Switzerland", coordinates: [47.3769, 8.5417], type: "city" }];
  },
}));
vi.mock("@/lib/routing/service", () => ({
  routingService: () => ({ alternatives: async () => ranked, loop: async () => ranked }),
}));

const { runAssistant, getConversation, hideIds } = await import("@/lib/ai/assistant");
const { runTool } = await import("@/lib/ai/tools");
const { inventedCoordinates, redactCoordinates, rememberNumbers, cleanName } = await import("@/lib/ai/guard");
const { issueChallenge, verifySolution, leadingZeroBits } = await import("@/lib/ai/pow");
const { parseInlineToolCall } = await import("@/lib/ai/providers/openai-compatible");
const { TOOLS } = await import("@/lib/ai/tools");
type ModelSession = import("@/lib/ai/providers/types").ModelSession;
type ModelTurn = import("@/lib/ai/providers/types").ModelTurn;
type AssistantEvent = import("@/lib/ai/types").AssistantEvent;

const context = { waypoints: [], profile: "road" as const, fitness: "intermediate" as const };

/** A fake model that plays back scripted turns and records what it was sent. */
function scripted(turns: ModelTurn[]) {
  const log: { users: string[]; results: { id: string; content: string; isError?: boolean }[][] } = { users: [], results: [] };
  const session: ModelSession = {
    addUser: (text) => log.users.push(text),
    step: async (onText) => {
      const turn = turns.shift() ?? { text: "", toolCalls: [], stop: "end" };
      if (turn.text) onText(turn.text);
      return turn;
    },
    addToolResults: (results) => log.results.push(results),
  };
  return { session, log };
}

async function run(turns: ModelTurn[], message = "Route from Zürich to Baden", isGuest = true) {
  const { session, log } = scripted(turns);
  const conversation = getConversation(undefined, `test-${Math.random()}`, () => session, context);
  const events: AssistantEvent[] = [];
  await runAssistant({
    conversation,
    message,
    context,
    toolContext: { isGuest, accessToken: null },
    emit: (e) => events.push(e),
    signal: new AbortController().signal,
  });
  const text = events.flatMap((e) => (e.type === "text" ? [e.delta] : [])).join("");
  return { events, log, text, conversation };
}

describe("assistant loop", () => {
  it("runs tool calls, returns results to the model and streams route cards", async () => {
    const { events, log, text } = await run([
      { text: "", toolCalls: [{ id: "1", name: "plan_route", input: { place_ids: ["Zürich", "Baden"] } }], stop: "tool_use" },
      { text: "Option 1 is quickest.", toolCalls: [], stop: "end" },
    ], "Route from Zürich to Baden");
    expect(log.results[0][0].isError).toBeFalsy();
    expect(JSON.parse(log.results[0][0].content).options).toHaveLength(2);
    expect(events.some((e) => e.type === "routes")).toBe(true);
    expect(text).toBe("Option 1 is quickest.");
    expect(events.at(-1)).toMatchObject({ type: "done" });
  });

  it("never sends coordinates to the model in tool results", async () => {
    const { log } = await run([
      { text: "", toolCalls: [{ id: "1", name: "geocode", input: { query: "Zürich" } }], stop: "tool_use" },
      { text: "", toolCalls: [{ id: "2", name: "plan_route", input: { place_ids: ["p1", "Baden"] } }], stop: "tool_use" },
      { text: "Done.", toolCalls: [], stop: "end" },
    ], "Route from Zürich to Baden");
    const sent = log.results.flat().map((r) => r.content).join(" ");
    expect(sent).not.toMatch(/47\.\d{3}|8\.5\d{2}/);
  });

  it("puts the studio context in the user turn as data", async () => {
    const { log } = await run([{ text: "Hi", toolCalls: [], stop: "end" }], "hello");
    expect(log.users[0]).toMatch(/^<studio_context>\{.*\}<\/studio_context>\n\nhello$/);
  });

  it("caps the number of tool calls per answer", async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: String(i), name: "compare_routes", input: { route_ids: ["r_x", "r_y"] } }));
    const { log } = await run([{ text: "", toolCalls: many, stop: "tool_use" }, { text: "ok", toolCalls: [], stop: "end" }]);
    const capped = log.results[0].filter((r) => r.content.includes("budget"));
    expect(capped).toHaveLength(4);
  });

  it("redacts coordinates the model invents and hides ids", async () => {
    const { text } = await run([
      { text: "", toolCalls: [{ id: "1", name: "plan_route", input: { place_ids: ["Zürich", "Baden"] } }], stop: "tool_use" },
      { text: `Start at 47.3769, 8.5417 and take ${ranked[1].id}.`, toolCalls: [], stop: "end" },
    ], "Route from Zürich to Baden");
    expect(text).not.toContain("47.3769");
    expect(text).toContain("[location]");
    expect(text).toContain("option 2");
  });

  it("answers refusals and length limits without running tools", async () => {
    const refused = await run([{ text: "", toolCalls: [{ id: "1", name: "geocode", input: { query: "x" } }], stop: "refusal" }]);
    expect(refused.log.results).toHaveLength(0);
    expect(refused.text).toMatch(/can't help/);
    const long = await run([{ text: "partial", toolCalls: [], stop: "max_tokens" }]);
    expect(long.text).toMatch(/length limit/);
  });
});

describe("tool validation", () => {
  const ctx = () => {
    const conversation = getConversation(undefined, `v-${Math.random()}`, () => scripted([]).session, context);
    conversation.state.riderText = " route from zürich to baden";
    return { state: conversation.state, isGuest: true, accessToken: null, signal: new AbortController().signal, emit: () => {} };
  };

  it("rejects unknown tools and bad arguments with a readable error", async () => {
    expect((await runTool("delete_everything", {}, ctx())).isError).toBe(true);
    const bad = await runTool("plan_loop", { start_place_id: "Zürich", distance_km: 900 }, ctx());
    expect(bad.isError).toBe(true);
    expect(bad.content).toMatch(/distance_km/);
  });

  it("accepts numbers and booleans sent as strings", async () => {
    const ok = await runTool("plan_loop", { start_place_id: "Zürich", distance_km: "40", preferences: { minimizeTraffic: "true" } }, ctx());
    expect(ok.isError).toBeFalsy();
  });

  it("only geocodes place names the rider actually wrote", async () => {
    const guessed = await runTool("plan_route", { place_ids: ["Geocode", "Baden"] }, ctx());
    expect(guessed.isError).toBe(true);
    expect(guessed.content).toMatch(/not a place the rider mentioned/);
    const unknownId = await runTool("plan_route", { place_ids: ["p9", "Baden"] }, ctx());
    expect(unknownId.content).toMatch(/Unknown place id p9/);
  });

  it("caps guest loop length", async () => {
    const res = await runTool("plan_loop", { start_place_id: "Zürich", distance_km: 150 }, ctx());
    expect(res.content).toMatch(/limited to about 80 km/);
  });

  it("offers sign-up instead of saving for guests", async () => {
    const c = ctx();
    const events: AssistantEvent[] = [];
    c.state.routes.set(ranked[0].id, ranked[0]);
    const res = await runTool("save_route", { route_id: ranked[0].id, name: "Limmat ride" }, { ...c, emit: (e) => events.push(e) });
    expect(JSON.parse(res.content)).toMatchObject({ saved: false });
    expect(events).toContainEqual({ type: "signup", reason: "save" });
  });

  it("every tool has a JSON schema that disallows extra keys and names its required fields", () => {
    for (const tool of TOOLS) {
      expect(tool.jsonSchema).toMatchObject({ type: "object", additionalProperties: false });
      expect(Array.isArray(tool.jsonSchema.required)).toBe(true);
    }
  });
});

describe("guards", () => {
  it("finds and redacts only unsourced coordinates", () => {
    const sourced = new Set<string>();
    rememberNumbers(sourced, '{"lat": 47.37690}');
    expect(inventedCoordinates("at 47.3769 and 8.5417", sourced)).toEqual(["8.5417"]);
    expect(redactCoordinates("at 47.3769 and 8.5417", sourced)).toBe("at 47.3769 and [location]");
    expect(inventedCoordinates("22.7 km and 551 m", sourced)).toEqual([]);
  });

  it("cleans untrusted names", () => {
    expect(cleanName("Café <script>\u0007 {x}")).toBe("Café script x");
  });

  it("hides route and place ids", () => {
    const { state } = getConversation(undefined, "ids", () => scripted([]).session, context);
    state.ranks.set("r_abc1", 2);
    state.places.set("p1", { id: "p1", name: "Uster", label: "Uster", point: [47.35, 8.72] });
    expect(hideIds("Take r_abc1 from p1, not r_zzz9.", state)).toBe("Take option 2 from Uster, not that route.");
  });

  it("turns a tool call written as text into a call, only for real tools", () => {
    expect(parseInlineToolCall('{"name": "plan_loop", "parameters": {"distance_km": 40}}', TOOLS)).toEqual({
      name: "plan_loop",
      args: { distance_km: 40 },
    });
    expect(parseInlineToolCall('{"name": "rm_rf", "parameters": {}}', TOOLS)).toBeNull();
    expect(parseInlineToolCall("Sure! Here you go.", TOOLS)).toBeNull();
  });
});

describe("proof of work", () => {
  function solve(challenge: string, difficulty: number) {
    let n = 0;
    while (leadingZeroBits(createHash("sha256").update(challenge + n).digest()) < difficulty) n++;
    return String(n);
  }

  it("accepts a solved challenge once", () => {
    const { challenge, difficulty } = issueChallenge();
    const nonce = solve(challenge, difficulty);
    expect(verifySolution(challenge, nonce)).toBe(true);
    expect(verifySolution(challenge, nonce)).toBe(false);
  });

  it("rejects tampered, expired and unsolved challenges", () => {
    const { challenge, difficulty } = issueChallenge();
    expect(verifySolution(challenge.replace(/.$/, "x"), solve(challenge, difficulty))).toBe(false);
    const old = issueChallenge(Date.now() - 11 * 60 * 1000);
    expect(verifySolution(old.challenge, solve(old.challenge, old.difficulty))).toBe(false);
    const fresh = issueChallenge();
    const wrong = Array.from({ length: 50 }, (_, i) => String(i)).find(
      (n) => leadingZeroBits(createHash("sha256").update(fresh.challenge + n).digest()) < fresh.difficulty,
    )!;
    expect(verifySolution(fresh.challenge, wrong)).toBe(false);
  });
});

describe("eval grading", () => {
  const trace = (patch = {}) => ({ tools: [], sourcedNumbers: [], routes: 0, signup: false, text: "", ...patch });

  it("passes when expected tools ran and no coordinates were invented", () => {
    const res = grade({ id: "x", turns: ["a"], expect: { tools: ["plan_loop"], routes: true } }, [
      trace({ tools: ["plan_loop"], routes: 3, text: "Option 1 is 41 km." }),
    ]);
    expect(res).toEqual({ pass: true, failures: [] });
  });

  it("fails on invented coordinates even when nothing else was expected", () => {
    const res = grade({ id: "x", turns: ["a"], expect: {} }, [trace({ text: "Start at 47.3769, 8.5417" })]);
    expect(res.pass).toBe(false);
    expect(res.failures[0]).toMatch(/invented coordinates/);
  });

  it("allows coordinates that a tool returned", () => {
    const res = grade({ id: "x", turns: ["a"], expect: {} }, [trace({ text: "47.3769", sourcedNumbers: ["47.37690"] })]);
    expect(res.pass).toBe(true);
  });
});
