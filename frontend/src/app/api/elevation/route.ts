import { NextResponse } from "next/server";
import { TtlCache } from "@/lib/cache";
import { errorResponse, parseBody, rateLimited } from "@/lib/api";
import { checkRate } from "@/lib/rate-limit";
import { requestContext } from "@/lib/request-context";
import { lookupElevations, resample } from "@/lib/routing/elevation";
import { ascentDescent, fnv1a, haversineM } from "@/lib/routing/metrics";
import { elevationRequest } from "@/lib/routing/schema";
import type { ElevationPoint } from "@/lib/routing/types";

const cache = new TtlCache<{ profile: ElevationPoint[]; ascentM: number; descentM: number }>(300, 24 * 60 * 60 * 1000);
const MAX_SAMPLES = 200;
const SPACING_M = 50;

/** POST /api/elevation — elevation profile for any polyline (e.g. a hand-drawn line). */
export async function POST(request: Request) {
  try {
    const { coordinates } = await parseBody(request, elevationRequest);
    const ctx = await requestContext();
    const retryAfter = checkRate("routing", request, ctx.sessionKey);
    if (retryAfter !== null) return rateLimited(retryAfter);

    let lengthM = 0;
    for (let i = 1; i < coordinates.length; i++) lengthM += haversineM(coordinates[i - 1], coordinates[i]);
    const points = resample(coordinates, Math.min(MAX_SAMPLES, Math.max(2, Math.ceil(lengthM / SPACING_M) + 1)));
    const key = fnv1a(JSON.stringify(points));
    const cached = cache.get(key);
    if (cached) return NextResponse.json(cached);

    const elevations = await lookupElevations(points, AbortSignal.timeout(10_000));
    let d = 0;
    const profile = points.map((p, i) => {
      if (i) d += haversineM(points[i - 1], p);
      return { d: Math.round(d), e: Math.round(elevations[i] * 10) / 10 };
    });
    const result = { profile, ...ascentDescent(elevations) };
    cache.set(key, result);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
