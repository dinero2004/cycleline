import { classifySurface, hasCycleway, isBusyRoad, parseTags } from "./surface";
import type {
  ElevationPoint,
  Fitness,
  LatLng,
  Position,
  RideProfile,
  Route,
  RouteSegment,
  RouteWarning,
  Surface,
} from "./types";

const EARTH_RADIUS_M = 6_371_000;

export function haversineM([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Cumulative distance in metres at every position. */
export function cumulativeDistances(coordinates: Position[]): number[] {
  const out = [0];
  for (let i = 1; i < coordinates.length; i++) {
    const [lng1, lat1] = coordinates[i - 1];
    const [lng2, lat2] = coordinates[i];
    out.push(out[i - 1] + haversineM([lat1, lng1], [lat2, lng2]));
  }
  return out;
}

/** Elevation at distance d, linearly interpolated. */
function elevationAt(distances: number[], coordinates: Position[], d: number): number {
  if (d <= 0) return coordinates[0][2];
  const last = distances.length - 1;
  if (d >= distances[last]) return coordinates[last][2];
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (distances[mid] <= d) lo = mid;
    else hi = mid;
  }
  const span = distances[hi] - distances[lo] || 1;
  const t = (d - distances[lo]) / span;
  return coordinates[lo][2] + (coordinates[hi][2] - coordinates[lo][2]) * t;
}

/** Ascent and descent with a small hysteresis so DEM noise doesn't count as climbing. */
export function ascentDescent(elevations: number[], threshold = 3): { ascentM: number; descentM: number } {
  let ascentM = 0;
  let descentM = 0;
  let ref = elevations[0] ?? 0;
  for (const e of elevations) {
    const diff = e - ref;
    if (diff >= threshold) {
      ascentM += diff;
      ref = e;
    } else if (diff <= -threshold) {
      descentM -= diff;
      ref = e;
    }
  }
  return { ascentM: Math.round(ascentM), descentM: Math.round(descentM) };
}

/** Grades over fixed windows (default 100 m), so single noisy points don't create fake walls. */
export function gradeWindows(distances: number[], coordinates: Position[], windowM = 100) {
  const total = distances[distances.length - 1] ?? 0;
  const windows: { startM: number; endM: number; gradePct: number }[] = [];
  for (let start = 0; start < total; start += windowM) {
    const end = Math.min(total, start + windowM);
    if (end - start < windowM / 2 && windows.length) break;
    const rise = elevationAt(distances, coordinates, end) - elevationAt(distances, coordinates, start);
    windows.push({ startM: start, endM: end, gradePct: (rise / (end - start)) * 100 });
  }
  return windows;
}

/** Downsampled elevation profile for charts. */
export function elevationProfile(route: Pick<Route, "geometry">, maxPoints = 240): ElevationPoint[] {
  const coordinates = route.geometry.coordinates;
  if (coordinates.length === 0) return [];
  const distances = cumulativeDistances(coordinates);
  const total = distances[distances.length - 1];
  const count = Math.min(maxPoints, coordinates.length);
  if (count < 2) return [{ d: 0, e: coordinates[0][2] }];
  return Array.from({ length: count }, (_, i) => {
    const d = (total * i) / (count - 1);
    return { d: Math.round(d), e: Math.round(elevationAt(distances, coordinates, d) * 10) / 10 };
  });
}

/** Position at a distance along the route, for linking the chart to the map. */
export function pointAtDistance(route: Pick<Route, "geometry">, d: number): LatLng {
  const coordinates = route.geometry.coordinates;
  const distances = cumulativeDistances(coordinates);
  let i = distances.findIndex((x) => x >= d);
  if (i <= 0) i = i === 0 ? 0 : coordinates.length - 1;
  const [lng, lat] = coordinates[i];
  return [lat, lng];
}

/** Distance along the route of the vertex nearest to a map point. */
export function distanceAtPoint(route: Pick<Route, "geometry">, [lat, lng]: LatLng): number {
  const coordinates = route.geometry.coordinates;
  const distances = cumulativeDistances(coordinates);
  let best = 0;
  let bestM = Infinity;
  coordinates.forEach(([x, y], i) => {
    const m = haversineM([lat, lng], [y, x]);
    if (m < bestM) {
      bestM = m;
      best = i;
    }
  });
  return distances[best] ?? 0;
}

export interface RawSegment {
  /** Length as reported by the provider; rescaled to the geometry's length. */
  lengthM: number;
  tags: Record<string, string>;
}

export interface BuildRouteInput {
  provider: string;
  profile: RideProfile;
  waypoints: LatLng[];
  coordinates: Position[];
  rawSegments: RawSegment[];
  providerDurationS: number | null;
  idSalt?: string;
}

const STEEP_PCT = 8;
const PAVED_PROFILES: RideProfile[] = ["road", "commuter", "ebike"];

/** Turns a provider's geometry and tagged segments into the normalized Route. */
export function buildRoute(input: BuildRouteInput): Route {
  const { coordinates } = input;
  const distances = cumulativeDistances(coordinates);
  const distanceM = Math.round(distances[distances.length - 1] ?? 0);
  const { ascentM, descentM } = ascentDescent(coordinates.map((c) => c[2]));

  const providerTotal = input.rawSegments.reduce((sum, s) => sum + s.lengthM, 0) || 1;
  const scale = distanceM / providerTotal;
  const segments: RouteSegment[] = [];
  let cursor = 0;
  for (const raw of input.rawSegments) {
    const len = raw.lengthM * scale;
    if (len <= 0) continue;
    const startM = cursor;
    const endM = Math.min(distanceM, cursor + len);
    cursor = endM;
    const { surface, inferred } = classifySurface(raw.tags);
    const rise = elevationAt(distances, coordinates, endM) - elevationAt(distances, coordinates, startM);
    const segment: RouteSegment = {
      startM: Math.round(startM),
      endM: Math.round(endM),
      surface,
      surfaceInferred: inferred,
      surfaceTag: raw.tags.surface,
      highway: raw.tags.highway,
      gradePct: round1((rise / Math.max(1, endM - startM)) * 100),
      cycleway: hasCycleway(raw.tags),
    };
    // Merge with the previous segment when nothing visible changes.
    const prev = segments[segments.length - 1];
    if (prev && prev.surface === segment.surface && prev.highway === segment.highway && prev.surfaceInferred === segment.surfaceInferred && prev.cycleway === segment.cycleway) {
      const prevRise = (prev.gradePct / 100) * (prev.endM - prev.startM);
      prev.endM = segment.endM;
      prev.gradePct = round1(((prevRise + rise) / Math.max(1, prev.endM - prev.startM)) * 100);
    } else {
      segments.push(segment);
    }
  }
  if (segments.length === 0 && distanceM > 0) {
    segments.push({ startM: 0, endM: distanceM, surface: "unknown", surfaceInferred: false, gradePct: 0, cycleway: false });
  }

  const surfaceMix: Record<Surface, number> = { paved: 0, gravel: 0, trail: 0, unknown: 0 };
  let inferredSurfaceM = 0;
  for (const s of segments) {
    surfaceMix[s.surface] += s.endM - s.startM;
    if (s.surfaceInferred) inferredSurfaceM += s.endM - s.startM;
  }

  const windows = gradeWindows(distances, coordinates);
  const maxGradePct = round1(Math.max(0, ...windows.map((w) => w.gradePct)));
  const uphill = windows.filter((w) => w.gradePct > 0.5);
  const uphillM = uphill.reduce((sum, w) => sum + (w.endM - w.startM), 0);
  const avgGradePct = uphillM ? round1(uphill.reduce((sum, w) => sum + w.gradePct * (w.endM - w.startM), 0) / uphillM) : 0;

  const warnings: RouteWarning[] = [
    ...mergeRanges(windows.filter((w) => w.gradePct > STEEP_PCT), 150).map((r) => ({
      kind: "steep" as const,
      message: `Steep: over ${STEEP_PCT}% for ${formatM(r.endM - r.startM)}`,
      ...r,
    })),
    ...mergeRanges(
      segments.filter((s) => isBusyRoad({ highway: s.highway ?? "", ...(s.cycleway ? { cycleway: "lane" } : {}) })),
      200,
    ).map((r) => ({ kind: "busy_road" as const, message: `Main road without a cycle lane for ${formatM(r.endM - r.startM)}`, ...r })),
    ...(PAVED_PROFILES.includes(input.profile)
      ? mergeRanges(segments.filter((s) => s.surface === "gravel" || s.surface === "trail"), 300).map((r) => ({
          kind: "unpaved" as const,
          message: `Unpaved for ${formatM(r.endM - r.startM)}`,
          ...r,
        }))
      : []),
  ].sort((a, b) => a.startM - b.startM);

  return {
    id: routeId(input),
    provider: input.provider,
    profile: input.profile,
    waypoints: input.waypoints,
    geometry: { type: "LineString", coordinates },
    distanceM,
    ascentM,
    descentM,
    providerDurationS: input.providerDurationS,
    maxGradePct,
    avgGradePct,
    elevation: elevationProfile({ geometry: { type: "LineString", coordinates } }),
    segments,
    surfaceMix,
    inferredSurfaceM: Math.round(inferredSurfaceM),
    warnings,
  };
}

/** Joins touching ranges and keeps those at least minM long. */
function mergeRanges(ranges: { startM: number; endM: number }[], minM: number) {
  const merged: { startM: number; endM: number }[] = [];
  for (const r of [...ranges].sort((a, b) => a.startM - b.startM)) {
    const last = merged[merged.length - 1];
    if (last && r.startM - last.endM <= 20) last.endM = Math.max(last.endM, r.endM);
    else merged.push({ startM: r.startM, endM: r.endM });
  }
  return merged.filter((r) => r.endM - r.startM >= minM).map((r) => ({ startM: Math.round(r.startM), endM: Math.round(r.endM) }));
}

// Flat-ground cruising speed (km/h) by fitness, before profile, surface and grade.
const FLAT_KMH: Record<Fitness, number> = { beginner: 18, intermediate: 23, strong: 28 };
const PROFILE_FACTOR: Record<RideProfile, number> = { road: 1, gravel: 0.9, mtb: 0.78, ebike: 1, commuter: 0.85 };
const SURFACE_FACTOR: Record<Surface, number> = { paved: 1, gravel: 0.82, trail: 0.65, unknown: 0.9 };

/** Speed (km/h) on one stretch: slower uphill, faster downhill within limits. */
export function speedKmh(fitness: Fitness, profile: RideProfile, surface: Surface, gradePct: number): number {
  // E-bikes get motor assist up to 25 km/h, so fitness matters much less.
  const flat = profile === "ebike" ? Math.max(FLAT_KMH[fitness], 22) : FLAT_KMH[fitness] * PROFILE_FACTOR[profile];
  const base = flat * SURFACE_FACTOR[surface];
  if (gradePct > 0) {
    const climbCost = profile === "ebike" ? 0.05 : 0.12;
    return Math.max(5, base / (1 + climbCost * gradePct));
  }
  const descentGain = Math.min(1.45, 1 + 0.04 * -gradePct);
  return Math.min(base * descentGain, surface === "paved" ? 45 : 30);
}

/** Ride time in seconds at a fitness level, from per-segment speed. Excludes stops. */
export function estimateDurationS(route: Pick<Route, "segments" | "profile">, fitness: Fitness): number {
  let seconds = 0;
  for (const s of route.segments) {
    const km = (s.endM - s.startM) / 1000;
    seconds += (km / speedKmh(fitness, route.profile, s.surface, s.gradePct)) * 3600;
  }
  return Math.round(seconds);
}

export type DifficultyLevel = "easy" | "moderate" | "hard" | "extreme";

/** 0–100 from distance, climbing per km, max grade and unpaved share. */
export function difficulty(route: Pick<Route, "distanceM" | "ascentM" | "maxGradePct" | "surfaceMix">): {
  score: number;
  level: DifficultyLevel;
} {
  const km = route.distanceM / 1000;
  const climbPerKm = km ? route.ascentM / km : 0;
  const unpaved = km ? (route.surfaceMix.gravel + route.surfaceMix.trail) / route.distanceM : 0;
  const score = Math.round(
    Math.min(35, (km / 150) * 35) +
      Math.min(30, (climbPerKm / 25) * 30) +
      Math.min(20, (route.maxGradePct / 15) * 20) +
      Math.min(15, unpaved * 15),
  );
  const level: DifficultyLevel = score < 30 ? "easy" : score < 55 ? "moderate" : score < 75 ? "hard" : "extreme";
  return { score, level };
}

/** Surface shares in whole percent that add up to 100. */
export function surfacePercentages(mix: Record<Surface, number>): Record<Surface, number> {
  const total = Object.values(mix).reduce((a, b) => a + b, 0);
  const keys = Object.keys(mix) as Surface[];
  if (!total) return { paved: 0, gravel: 0, trail: 0, unknown: 0 };
  const raw = keys.map((k) => ({ k, v: (mix[k] / total) * 100 }));
  const floored = raw.map((r) => ({ ...r, f: Math.floor(r.v) }));
  let left = 100 - floored.reduce((sum, r) => sum + r.f, 0);
  for (const r of [...floored].sort((a, b) => b.v - b.f - (a.v - a.f))) {
    if (left-- <= 0) break;
    r.f += 1;
  }
  return Object.fromEntries(floored.map((r) => [r.k, r.f])) as Record<Surface, number>;
}

export function formatM(m: number): string {
  return m >= 1000 ? `${round1(m / 1000)} km` : `${Math.round(m)} m`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** Stable id from what defines the route, so caches and the AI can refer to it. */
export function routeId(input: Pick<BuildRouteInput, "provider" | "profile" | "waypoints" | "idSalt" | "coordinates">): string {
  const key = JSON.stringify([input.provider, input.profile, input.waypoints, input.idSalt ?? "", input.coordinates.length]);
  return `r_${fnv1a(key)}`;
}

export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export { parseTags };
