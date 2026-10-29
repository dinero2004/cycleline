import { z } from "zod";
import { haversineM } from "./metrics";
import type { LatLng } from "./types";

export const MAX_WAYPOINTS = 25;
/** Route length cap (straight-line sum between waypoints); guests get a lower cap, see lib/guest. */
export const MAX_ROUTE_KM = Number(process.env.MAX_ROUTE_KM ?? 300);

export const latLng = z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]);
export const rideProfile = z.enum(["road", "gravel", "mtb", "ebike", "commuter"]);
export const fitness = z.enum(["beginner", "intermediate", "strong"]);

export const preferences = z
  .object({
    maxGradePct: z.number().min(2).max(30).optional(),
    avoidHighways: z.boolean().optional(),
    preferCycleways: z.boolean().optional(),
    surface: z.enum(["paved", "mixed", "gravel"]).optional(),
    minimizeTraffic: z.boolean().optional(),
    scenic: z.number().min(0).max(1).optional(),
  })
  .strict()
  .default({});

export const routeRequest = z.object({
  waypoints: z.array(latLng).min(2).max(MAX_WAYPOINTS),
  profile: rideProfile.default("road"),
  preferences,
  fitness: fitness.default("intermediate"),
});

export const loopRequest = z.object({
  start: latLng,
  distanceKm: z.number().min(5).max(200),
  /** Compass bearing in degrees to head out on; omitted = try several directions. */
  bearing: z.number().min(0).max(360).optional(),
  profile: rideProfile.default("road"),
  preferences,
  fitness: fitness.default("intermediate"),
});

export const elevationRequest = z.object({
  coordinates: z.array(latLng).min(2).max(5000),
});

export const gpxRequest = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(1000).optional(),
  coordinates: z
    .array(z.union([z.tuple([z.number(), z.number(), z.number()]), latLng]))
    .min(2)
    .max(20000),
  waypoints: z.array(z.object({ point: latLng, name: z.string().max(80) })).max(MAX_WAYPOINTS).optional(),
});

/** Sum of straight-line distances between consecutive waypoints, km. */
export function straightLineKm(waypoints: LatLng[]): number {
  let m = 0;
  for (let i = 1; i < waypoints.length; i++) m += haversineM(waypoints[i - 1], waypoints[i]);
  return m / 1000;
}

export type RouteRequest = z.infer<typeof routeRequest>;
export type LoopRequest = z.infer<typeof loopRequest>;
