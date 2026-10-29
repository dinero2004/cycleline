import { NextResponse } from "next/server";
import type { z } from "zod";
import { RoutingError, type Fitness, type RideProfile } from "@/lib/routing/types";
import type { BikeType, FitnessLevel } from "@/types";

/** Typed error body every endpoint returns: { error: { code, message } }. */
export function errorResponse(error: unknown, headers?: HeadersInit) {
  if (error instanceof RoutingError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status, headers });
  }
  console.error(JSON.stringify({ at: "api", error: error instanceof Error ? error.message : String(error) }));
  return NextResponse.json(
    { error: { code: "internal", message: "Something went wrong on our side. Try again in a moment." } },
    { status: 500, headers },
  );
}

export function rateLimited(retryAfterS: number) {
  return errorResponse(
    new RoutingError("rate_limited", `Too many requests. Try again in ${retryAfterS} s.`),
    { "Retry-After": String(retryAfterS) },
  );
}

/** Parses a JSON body against a schema; invalid input becomes a 422 with the first problem. */
export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const raw = await request.json().catch(() => {
    throw new RoutingError("invalid_request", "The request body is not valid JSON.");
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    throw new RoutingError("invalid_request", `${where}${issue?.message ?? "Invalid request."}`);
  }
  return parsed.data;
}

const PROFILE_FOR_BIKE: Record<BikeType, RideProfile> = {
  road: "road",
  gravel: "gravel",
  mountain: "mtb",
  city: "commuter",
  electric: "ebike",
  touring: "commuter",
};

export const rideProfileForBike = (bike: BikeType): RideProfile => PROFILE_FOR_BIKE[bike] ?? "road";
export const fitnessFor = (level: FitnessLevel | undefined): Fitness => (level === "advanced" ? "strong" : level ?? "intermediate");
