import { NextResponse } from "next/server";
import { errorResponse, parseBody, rateLimited } from "@/lib/api";
import { requestContext } from "@/lib/request-context";
import { guardRouting } from "@/lib/routing/guard";
import { routeRequest } from "@/lib/routing/schema";
import { routingService } from "@/lib/routing/service";

/** POST /api/route/alternatives — up to 3 ranked candidates with a "why this route" line each. */
export async function POST(request: Request) {
  try {
    const input = await parseBody(request, routeRequest);
    const ctx = await requestContext();
    const retryAfter = guardRouting(request, ctx, input.waypoints, 2);
    if (retryAfter !== null) return rateLimited(retryAfter);
    return NextResponse.json({ routes: await routingService().alternatives(input) });
  } catch (error) {
    return errorResponse(error);
  }
}
