import { NextResponse } from "next/server";
import { errorResponse, parseBody, rateLimited } from "@/lib/api";
import { requestContext } from "@/lib/request-context";
import { guardRouting } from "@/lib/routing/guard";
import { loopRequest } from "@/lib/routing/schema";
import { destination, routingService } from "@/lib/routing/service";

/** POST /api/route/loop — start, target distance, optional bearing → round-trip candidates. */
export async function POST(request: Request) {
  try {
    const input = await parseBody(request, loopRequest);
    const ctx = await requestContext();
    // Length check on the loop's rough extent: out and back along the target distance.
    const far = destination(input.start, input.bearing ?? 0, (input.distanceKm * 1000) / 2);
    const retryAfter = guardRouting(request, ctx, [input.start, far, input.start], 2);
    if (retryAfter !== null) return rateLimited(retryAfter);
    return NextResponse.json({ routes: await routingService().loop(input) });
  } catch (error) {
    return errorResponse(error);
  }
}
