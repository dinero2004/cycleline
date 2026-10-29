import "server-only";

import { GUEST_LIMITS } from "@/lib/guest";
import { RateLimiter, checkRate, clientIp } from "@/lib/rate-limit";
import type { RequestContext } from "@/lib/request-context";
import { straightLineKm } from "./schema";
import { RoutingError, type LatLng } from "./types";

const guestDaily = new RateLimiter(GUEST_LIMITS.routesPerDay, 24 * 60 * 60 * 1000);

/**
 * Checks rate limits, the route-length cap and the guest daily quota before a routing call.
 * Returns retry-after seconds when rate limited, otherwise throws or returns null.
 */
export function guardRouting(request: Request, ctx: RequestContext, waypoints: LatLng[], cost = 1): number | null {
  const retryAfter = checkRate("routing", request, ctx.sessionKey);
  if (retryAfter !== null) return retryAfter;

  const km = straightLineKm(waypoints);
  if (km > ctx.maxRouteKm) {
    throw new RoutingError(
      "too_long",
      ctx.isGuest
        ? `Guest routes are limited to about ${ctx.maxRouteKm} km. Create a free account to plan longer rides.`
        : `Routes are limited to about ${ctx.maxRouteKm} km. Split the ride into stages.`,
    );
  }

  if (ctx.isGuest) {
    let ok = true;
    for (let i = 0; i < cost; i++) ok = guestDaily.take(ctx.sessionKey ?? `ip:${clientIp(request)}`).ok && ok;
    if (!ok) {
      throw new RoutingError(
        "rate_limited",
        `That's today's ${GUEST_LIMITS.routesPerDay} demo routes. Create a free account to keep planning — your drafts come with you.`,
      );
    }
  }
  return null;
}
