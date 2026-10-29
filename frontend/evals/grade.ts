/** Grading for the route assistant evals; shared by the runner and its unit test. */

export interface EvalCase {
  id: string;
  turns: string[];
  expect: {
    /** Each listed tool must be called at least once over the conversation ([] = no tool calls at all). */
    tools?: string[];
    /** Each listed tool must be called in the final turn. */
    lastTurnTools?: string[];
    routes?: boolean;
    noRoutes?: boolean;
    signup?: boolean;
    asksQuestion?: boolean;
    noCoordinates?: boolean;
  };
}

export interface TurnTrace {
  tools: string[];
  /** Tool results as the model saw them aren't streamed; numbers from routes/tools the UI received. */
  sourcedNumbers: string[];
  routes: number;
  signup: boolean;
  text: string;
  error?: string;
}

const COORDINATE = /-?\b\d{1,3}\.\d{3,}\b/g;

/** Coordinate-like numbers in the reply that no tool result contained. Always checked. */
export function inventedCoordinates(text: string, sourced: string[]): string[] {
  const known = new Set(sourced.map((n) => String(Math.round(Number(n) * 1e4) / 1e4)));
  return (text.match(COORDINATE) ?? []).filter((n) => !known.has(String(Math.round(Number(n) * 1e4) / 1e4)));
}

export function grade(c: EvalCase, turns: TurnTrace[]): { pass: boolean; failures: string[] } {
  const failures: string[] = [];
  const all = turns.flatMap((t) => t.tools);
  const last = turns[turns.length - 1];
  const e = c.expect;

  if (e.tools) {
    if (e.tools.length === 0 && all.length) failures.push(`expected no tool calls, got ${all.join(", ")}`);
    for (const tool of e.tools) if (!all.includes(tool)) failures.push(`missing tool call ${tool}`);
  }
  for (const tool of e.lastTurnTools ?? []) if (!last.tools.includes(tool)) failures.push(`last turn missing ${tool}`);
  if (e.routes && !turns.some((t) => t.routes > 0)) failures.push("no route cards");
  if (e.noRoutes && turns.some((t) => t.routes > 0)) failures.push("unexpected route cards");
  if (e.signup && !turns.some((t) => t.signup)) failures.push("no signup prompt");
  if (e.asksQuestion && !/\?/.test(last.text)) failures.push("did not ask a clarifying question");
  if (e.asksQuestion && (last.text.match(/\?/g) ?? []).length > 2) failures.push("asked more than one question");

  // Hard rule for every case: no coordinates that didn't come from a tool.
  const sourced = turns.flatMap((t) => t.sourcedNumbers);
  for (const t of turns) {
    const invented = inventedCoordinates(t.text, sourced);
    if (invented.length) failures.push(`invented coordinates: ${invented.join(", ")}`);
  }
  if (e.noCoordinates && turns.some((t) => (t.text.match(COORDINATE) ?? []).length)) failures.push("reply contains coordinates");
  for (const t of turns) if (t.error) failures.push(`error: ${t.error}`);

  return { pass: failures.length === 0, failures };
}
