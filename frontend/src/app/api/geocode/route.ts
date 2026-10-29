import { NextRequest, NextResponse } from "next/server";
import { errorResponse, rateLimited } from "@/lib/api";
import { searchPlaces } from "@/lib/geocode";
import { checkRate } from "@/lib/rate-limit";
import { requestContext } from "@/lib/request-context";
import { RoutingError } from "@/lib/routing/types";

/**
 * GET /api/geocode?q=…&limit=5 — place search and autocomplete.
 * The first match is also returned as { name, coordinates } for the original planner.
 */
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(8, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 1) || 1));
    if (query.length < 3 || query.length > 200) {
      throw new RoutingError("invalid_request", "Enter at least three characters.");
    }
    const ctx = await requestContext();
    const retryAfter = checkRate("geocode", request, ctx.sessionKey);
    if (retryAfter !== null) return rateLimited(retryAfter);

    const results = await searchPlaces(query, limit, AbortSignal.timeout(8000));
    if (!results.length) throw new RoutingError("no_route", `No place matched “${query}”.`);
    return NextResponse.json({ name: results[0].label, coordinates: results[0].coordinates, results });
  } catch (error) {
    return errorResponse(error);
  }
}
