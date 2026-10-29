/**
 * Runs the route assistant evals against a running app (real model, real tools).
 *   AI_EVAL_TOKEN=… npx tsx evals/run.ts [BASE_URL] [case-id …]
 * The server must have the same AI_EVAL_TOKEN set; it lifts guest quotas for these requests only.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { grade, type EvalCase, type TurnTrace } from "./grade";

const base = process.argv[2]?.startsWith("http") ? process.argv[2] : "http://localhost:3300";
const only = process.argv.slice(2).filter((a) => !a.startsWith("http"));
const token = process.env.AI_EVAL_TOKEN;
if (!token) {
  console.error("Set AI_EVAL_TOKEN (the same value the server has).");
  process.exit(1);
}

const cases = (JSON.parse(readFileSync(join(__dirname, "route-assistant.cases.json"), "utf8")) as EvalCase[]).filter(
  (c) => !only.length || only.includes(c.id),
);

async function turn(message: string, conversationId?: string): Promise<{ trace: TurnTrace; conversationId?: string }> {
  const trace: TurnTrace = { tools: [], sourcedNumbers: [], routes: 0, signup: false, text: "" };
  const response = await fetch(`${base}/api/assistant`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-eval-token": token! },
    body: JSON.stringify({ message, conversationId, context: { waypoints: [], profile: "road", fitness: "intermediate" } }),
  });
  if (!response.ok) {
    trace.error = `HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`;
    return { trace, conversationId };
  }
  let id = conversationId;
  for (const block of (await response.text()).split("\n\n")) {
    const line = block.split("\n").find((l) => l.startsWith("data:"));
    if (!line) continue;
    const event = JSON.parse(line.slice(5));
    if (event.type === "start") id = event.conversationId;
    if (event.type === "text") trace.text += event.delta;
    if (event.type === "tool" && event.status === "running") trace.tools.push(event.name);
    if (event.type === "routes") {
      trace.routes += event.routes.length;
      trace.sourcedNumbers.push(...(JSON.stringify(event.routes).match(/-?\d{1,3}\.\d{3,}/g) ?? []));
    }
    if (event.type === "signup") trace.signup = true;
    if (event.type === "error") trace.error = event.message;
  }
  return { trace, conversationId: id };
}

async function main() {
  const results = [];
  for (const c of cases) {
    const started = Date.now();
    const traces: TurnTrace[] = [];
    let conversationId: string | undefined;
    for (const message of c.turns) {
      const out = await turn(message, conversationId);
      traces.push(out.trace);
      conversationId = out.conversationId;
    }
    const verdict = grade(c, traces);
    results.push({ id: c.id, ...verdict, seconds: Math.round((Date.now() - started) / 100) / 10, tools: traces.map((t) => t.tools) });
    console.log(`${verdict.pass ? "PASS" : "FAIL"}  ${c.id}  ${verdict.failures.join("; ")}`);
  }
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} passed`);
  writeFileSync(join(__dirname, "last-run.json"), `${JSON.stringify({ base, at: new Date().toISOString(), results }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
