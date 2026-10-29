import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, parseBody, rateLimited, rideProfileForBike } from "@/lib/api";
import { requestContext } from "@/lib/request-context";
import { guardRouting } from "@/lib/routing/guard";
import { latLng, routeRequest } from "@/lib/routing/schema";
import { routingService } from "@/lib/routing/service";
import type { BikeType } from "@/types";

// The original planner sent { start, end, profile: BikeType, routeType }; still accepted.
const legacyRequest = z
  .object({
    start: latLng,
    end: latLng,
    profile: z.enum(["road", "gravel", "mountain", "city", "electric", "touring"]),
    routeType: z.enum(["one-way", "round-trip"]).default("one-way"),
  })
  .transform((legacy) => ({
    waypoints: legacy.routeType === "round-trip" ? [legacy.start, legacy.end, legacy.start] : [legacy.start, legacy.end],
    profile: rideProfileForBike(legacy.profile as BikeType),
    preferences: {},
    fitness: "intermediate" as const,
  }));

const body = z.union([routeRequest, legacyRequest]);

/** POST /api/route — waypoints, profile, preferences → one normalized Route. */
export async function POST(request: Request) {
  try {
    const input = await parseBody(request, body);
    const ctx = await requestContext();
    const retryAfter = guardRouting(request, ctx, input.waypoints);
    if (retryAfter !== null) return rateLimited(retryAfter);
    return NextResponse.json({ route: await routingService().route(input) });
  } catch (error) {
    return errorResponse(error);
  }
}
