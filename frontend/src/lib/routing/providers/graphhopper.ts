import { buildRoute, haversineM, type RawSegment } from "../metrics";
import { RoutingError, type Position, type RideProfile } from "../types";
import type { RoutingProvider } from "./types";

interface GraphHopperPath {
  distance: number;
  time: number;
  points: { coordinates: [number, number, number?][] };
  details?: { surface?: [number, number, string][]; road_class?: [number, number, string][] };
}

// "bike" is on every GraphHopper plan; racingbike and mtb need a paid plan, so they are opt-in.
const PROFILES: Record<RideProfile, string> = {
  road: process.env.GRAPHHOPPER_ROAD_PROFILE ?? "bike",
  gravel: "bike",
  mtb: process.env.GRAPHHOPPER_MTB_PROFILE ?? "bike",
  ebike: "bike",
  commuter: "bike",
};

/** Turns GraphHopper's point-index "details" into segments with surface and road-class tags. */
export function graphhopperSegments(path: GraphHopperPath, coordinates: Position[]): RawSegment[] {
  const surface = path.details?.surface ?? [];
  const roadClass = path.details?.road_class ?? [];
  const cuts = new Set<number>([0, coordinates.length - 1]);
  for (const [from, to] of [...surface, ...roadClass]) {
    cuts.add(from);
    cuts.add(to);
  }
  const sorted = [...cuts].sort((a, b) => a - b);
  const valueAt = (list: [number, number, string][], index: number) => list.find(([from, to]) => index >= from && index < to)?.[2];
  const segments: RawSegment[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const from = sorted[i - 1];
    const to = sorted[i];
    let lengthM = 0;
    for (let j = from + 1; j <= to; j++) {
      lengthM += haversineM([coordinates[j - 1][1], coordinates[j - 1][0]], [coordinates[j][1], coordinates[j][0]]);
    }
    const tags: Record<string, string> = {};
    const s = valueAt(surface, from);
    const r = valueAt(roadClass, from);
    if (s && s !== "missing" && s !== "other") tags.surface = s.toLowerCase();
    if (r && r !== "other") tags.highway = r.toLowerCase();
    segments.push({ lengthM, tags });
  }
  return segments;
}

export function createGraphHopper(apiKey = process.env.GRAPHHOPPER_API_KEY, baseUrl = process.env.GRAPHHOPPER_URL ?? "https://graphhopper.com/api/1"): RoutingProvider {
  return {
    name: "graphhopper",
    maxAlternative: 2,
    isConfigured: () => Boolean(apiKey),
    async route(request, signal) {
      const body: Record<string, unknown> = {
        points: request.waypoints.map(([lat, lng]) => [lng, lat]),
        profile: PROFILES[request.profile],
        points_encoded: false,
        elevation: true,
        instructions: false,
        details: ["surface", "road_class"],
      };
      if (request.alternative > 0 && request.waypoints.length === 2) {
        body["algorithm"] = "alternative_route";
        body["alternative_route.max_paths"] = request.alternative + 1;
      }
      const response = await fetch(`${baseUrl}/route?key=${encodeURIComponent(apiKey ?? "")}`, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as { paths?: GraphHopperPath[]; message?: string };
      if (!response.ok) {
        if (response.status === 400 && /connection between locations not found|cannot find point/i.test(data.message ?? "")) {
          throw new RoutingError("no_route", "No cycling path found between these points.");
        }
        throw new RoutingError("provider_unavailable", `GraphHopper answered ${response.status}.`);
      }
      const path = data.paths?.[Math.min(request.alternative, (data.paths?.length ?? 1) - 1)];
      if (!path?.points.coordinates.length) throw new RoutingError("no_route", "No cycling path found between these points.");
      const coordinates: Position[] = path.points.coordinates.map(([lng, lat, ele]) => [lng, lat, ele ?? 0]);
      return buildRoute({
        provider: "graphhopper",
        profile: request.profile,
        waypoints: request.waypoints,
        coordinates,
        rawSegments: graphhopperSegments(path, coordinates),
        providerDurationS: Math.round(path.time / 1000),
        idSalt: `gh:${request.alternative}`,
      });
    },
  };
}
