import { buildRoute, difficulty, estimateDurationS } from "@/lib/routing/metrics";
import { simplifyRoute } from "@/lib/routing/simplify";
import type { Fitness, LatLng, Position, RideProfile, Route, RoutePreferences } from "@/lib/routing/types";
import type { BikeType, FitnessLevel, RouteDetails } from "@/types";

export interface Waypoint {
  id: string;
  point: LatLng;
  label?: string;
}

export interface StudioDraft {
  name: string;
  waypoints: Waypoint[];
  profile: RideProfile;
  preferences: RoutePreferences;
  snap: boolean;
  route: Route | null;
  updatedAt: number;
}

let counter = 0;
export const waypointId = () => `w${Date.now().toString(36)}${(counter++).toString(36)}`;

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** Share link query: w=lat,lng|lat,lng&p=gravel (no account data, just the plan). */
export function encodeShare(waypoints: Waypoint[], profile: RideProfile, name: string): string {
  const params = new URLSearchParams();
  params.set("w", waypoints.map((w) => `${round5(w.point[0])},${round5(w.point[1])}`).join("|"));
  params.set("p", profile);
  if (name) params.set("n", name.slice(0, 80));
  return params.toString();
}

const PROFILES: RideProfile[] = ["road", "gravel", "mtb", "ebike", "commuter"];

export function decodeShare(params: { w?: string; p?: string; n?: string }): { waypoints: Waypoint[]; profile?: RideProfile; name?: string } | null {
  if (!params.w) return null;
  const waypoints = params.w
    .split("|")
    .slice(0, 25)
    .map((pair) => pair.split(",").map(Number))
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180)
    .map(([lat, lng]) => ({ id: waypointId(), point: [lat, lng] as LatLng }));
  if (waypoints.length < 2) return null;
  return {
    waypoints,
    profile: PROFILES.includes(params.p as RideProfile) ? (params.p as RideProfile) : undefined,
    name: params.n?.slice(0, 80),
  };
}

/** Straight-line route ("snap to road" off) from a sampled, height-annotated line. Surface is unknown. */
export function manualRoute(coordinates: Position[], waypoints: LatLng[], profile: RideProfile): Route {
  let lengthM = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const [lng1, lat1] = coordinates[i - 1];
    const [lng2, lat2] = coordinates[i];
    lengthM += Math.hypot((lng2 - lng1) * 111_320 * Math.cos((lat1 * Math.PI) / 180), (lat2 - lat1) * 110_540);
  }
  return buildRoute({ provider: "manual", profile, waypoints, coordinates, rawSegments: [{ lengthM, tags: {} }], providerDurationS: null });
}

const BIKE_FOR_PROFILE: Record<RideProfile, BikeType> = {
  road: "road",
  gravel: "gravel",
  mtb: "mountain",
  ebike: "electric",
  commuter: "city",
};

const LEVEL_FOR_DIFFICULTY = { easy: "beginner", moderate: "intermediate", hard: "advanced", extreme: "advanced" } as const;

export interface StudioSaveInput {
  name: string;
  description?: string;
  startName: string;
  endName: string;
  bikeId: number | null;
  route: Route;
  fitness: Fitness;
}

/** Body for the Laravel /routes endpoint, including the Route Studio details. */
export function toBackendRoute({ name, description, startName, endName, bikeId, route, fitness }: StudioSaveInput) {
  const light = simplifyRoute(route, 3);
  const coordinates = light.geometry.coordinates.map(([lng, lat]) => [round5(lat), round5(lng)]);
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  const closed = route.waypoints.length > 2 && route.waypoints[0].join() === route.waypoints[route.waypoints.length - 1].join();
  const details: RouteDetails = {
    ride_profile: route.profile,
    provider: route.provider,
    waypoints: route.waypoints,
    elevation: route.elevation.filter((_, i, all) => all.length <= 400 || i % Math.ceil(all.length / 400) === 0),
    surface_mix: route.surfaceMix,
    inferred_surface_m: route.inferredSurfaceM,
    descent_m: route.descentM,
    max_grade_pct: route.maxGradePct,
    avg_grade_pct: route.avgGradePct,
    warnings: route.warnings.map((w) => w.message).slice(0, 40),
  };
  return {
    bike_id: bikeId,
    name,
    description: description || null,
    start_name: startName.slice(0, 255),
    end_name: endName.slice(0, 255),
    start_lat: first[0],
    start_lng: first[1],
    end_lat: last[0],
    end_lng: last[1],
    distance_km: Math.max(0.1, Math.round(route.distanceM / 10) / 100),
    duration_minutes: Math.max(1, Math.round(estimateDurationS(route, fitness) / 60)),
    elevation_gain_m: route.ascentM,
    difficulty: LEVEL_FOR_DIFFICULTY[difficulty(route).level] as FitnessLevel,
    route_type: closed ? "round-trip" : "one-way",
    profile: BIKE_FOR_PROFILE[route.profile],
    coordinates,
    details,
  };
}

export const RIDE_PROFILES: { value: RideProfile; label: string }[] = [
  { value: "road", label: "Road" },
  { value: "gravel", label: "Gravel" },
  { value: "mtb", label: "MTB" },
  { value: "ebike", label: "E-bike" },
  { value: "commuter", label: "Commuter" },
];
