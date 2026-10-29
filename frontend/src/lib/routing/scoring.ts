import { estimateDurationS, formatDuration, formatM } from "./metrics";
import { isBusyRoad } from "./surface";
import type { Fitness, RankedRoute, Route, RoutePreferences } from "./types";

interface Facts {
  durationS: number;
  ascentM: number;
  unpavedShare: number;
  gravelShare: number;
  busyShare: number;
  busyM: number;
  cyclewayShare: number;
  unknownShare: number;
}

function facts(route: Route, fitness: Fitness): Facts {
  const total = route.distanceM || 1;
  let busyM = 0;
  let cyclewayM = 0;
  for (const s of route.segments) {
    const len = s.endM - s.startM;
    if (isBusyRoad({ highway: s.highway ?? "", ...(s.cycleway ? { cycleway: "lane" } : {}) })) busyM += len;
    if (s.cycleway) cyclewayM += len;
  }
  return {
    durationS: estimateDurationS(route, fitness),
    ascentM: route.ascentM,
    unpavedShare: (route.surfaceMix.gravel + route.surfaceMix.trail) / total,
    gravelShare: route.surfaceMix.gravel / total,
    busyShare: busyM / total,
    busyM,
    cyclewayShare: cyclewayM / total,
    unknownShare: route.surfaceMix.unknown / total,
  };
}

export interface ScoreOptions {
  fitness: Fitness;
  preferences: RoutePreferences;
  /** For loops: the distance the rider asked for. */
  targetDistanceM?: number;
}

/** Scores each candidate (0–100) against the rider's constraints and ranks them, best first. */
export function rankRoutes(routes: Route[], { fitness, preferences: p, targetDistanceM }: ScoreOptions): RankedRoute[] {
  if (routes.length === 0) return [];
  const all = routes.map((route) => ({ route, f: facts(route, fitness) }));
  const fastest = Math.min(...all.map((x) => x.f.durationS));
  const scenic = p.scenic ?? 0;

  const scored = all.map(({ route, f }) => {
    let score = 100;
    if (p.maxGradePct && route.maxGradePct > p.maxGradePct) score -= (route.maxGradePct - p.maxGradePct) * 6;
    if (p.surface === "paved") score -= f.unpavedShare * 60;
    if (p.surface === "gravel") score -= (1 - f.gravelShare) * 40;
    if (p.surface === "mixed") score -= Math.abs(f.gravelShare - 0.4) * 30;
    score -= f.busyShare * (p.minimizeTraffic || p.avoidHighways ? 80 : 25);
    score += f.cyclewayShare * (p.preferCycleways ? 20 : 5);
    score -= (f.durationS / fastest - 1) * 40 * (1 - scenic);
    score -= f.unknownShare * 10;
    if (targetDistanceM) score -= Math.abs(route.distanceM / targetDistanceM - 1) * 80;
    return { route, f, raw: score, score: Math.max(0, Math.min(100, Math.round(score))) };
  });

  // Rank on the raw score so candidates that both hit the 100 cap still have an order.
  scored.sort((a, b) => b.raw - a.raw);
  return scored.map(({ route, f, score }) => ({ ...route, score, why: explain(route, f, scored, { fitness, preferences: p, targetDistanceM }) }));
}

/** One plain sentence: what this candidate does best, and the main catch. */
function explain(
  route: Route,
  f: Facts,
  all: { route: Route; f: Facts }[],
  { fitness, preferences: p, targetDistanceM }: ScoreOptions,
): string {
  const best = (pick: (x: { route: Route; f: Facts }) => number) =>
    all.length > 1 && all.every((x) => pick(x) >= pick({ route, f }) - 1e-9);
  const strengths: string[] = [];
  if (targetDistanceM && best((x) => Math.abs(x.route.distanceM - targetDistanceM))) {
    strengths.push(`closest to your ${formatM(targetDistanceM)}`);
  }
  if (best((x) => x.f.durationS)) strengths.push(`quickest at ${formatDuration(f.durationS)} at ${fitness} pace`);
  if (best((x) => x.f.ascentM)) strengths.push(`least climbing (${route.ascentM} m)`);
  if (best((x) => x.f.busyM) && f.busyM < 500) strengths.push("fewest main roads");
  if (p.surface === "paved" && best((x) => x.f.unpavedShare)) strengths.push("most paved");
  if (p.surface === "gravel" && best((x) => -x.f.gravelShare)) strengths.push("most gravel");
  if (strengths.length === 0) strengths.push(`${formatM(route.distanceM)} with ${route.ascentM} m of climbing`);

  const catches: string[] = [];
  if (p.maxGradePct && route.maxGradePct > p.maxGradePct) {
    catches.push(`it reaches ${route.maxGradePct}%, above your ${p.maxGradePct}% limit`);
  }
  if (f.busyM >= 500) catches.push(`${formatM(f.busyM)} on main roads without a cycle lane`);
  if (f.unknownShare > 0.15) catches.push(`${Math.round(f.unknownShare * 100)}% of the surface is unknown`);

  const lead = strengths.slice(0, 2).join(" and ");
  const sentence = `${lead.charAt(0).toUpperCase()}${lead.slice(1)}`;
  return catches.length ? `${sentence}, but ${catches[0]}.` : `${sentence}.`;
}

/** Drops candidates that are practically the same line (distance and climb within a few percent). */
export function dedupeRoutes<T extends Route>(routes: T[]): T[] {
  const out: T[] = [];
  for (const r of routes) {
    const dup = out.some(
      (o) => Math.abs(o.distanceM - r.distanceM) / Math.max(1, o.distanceM) < 0.015 && Math.abs(o.ascentM - r.ascentM) <= Math.max(10, o.ascentM * 0.05),
    );
    if (!dup) out.push(r);
  }
  return out;
}
