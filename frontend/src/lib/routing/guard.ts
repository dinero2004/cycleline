import "server-only";

import { GUEST_LIMITS } from "@/lib/guest";
import { RateLimiter, checkRate, clientIp } from "@/lib/rate-limit";
import type { RequestContext } from "@/lib/request-context";
import { straightLineKm } from "./schema";
import { RoutingError, type LatLng } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Hard ceiling on guest routing requests per day (drawing and dragging make many). */
const guestRequests = new RateLimiter(Number(process.env.GUEST_ROUTING_REQUESTS_PER_DAY ?? 400), DAY_MS);
/** Distinct routes per guest per day, keyed by start and finish (~100 m), so editing one route counts once. */
const guestRoutes = new Map<string, { resetAt: number; routes: Set<string> }>();

const cell = ([lat, lng]: LatLng) => `${lat.toFixed(3)},${lng.toFixed(3)}`;

function countGuestRoute(guest: string, waypoints: LatLng[], now = Date.now()): boolean {
  let entry = guestRoutes.get(guest);
  if (!entry || entry.resetAt <= now) {
    entry = { resetAt: now + DAY_MS, routes: new Set() };
    guestRoutes.set(guest, entry);
    if (guestRoutes.size > 20_000) for (const [key, e] of guestRoutes) if (e.resetAt <= now) guestRoutes.delete(key);
  }
  const key = `${cell(waypoints[0])}>${cell(waypoints[waypoints.length - 1])}`;
  if (entry.routes.has(key)) return true;
  if (entry.routes.size >= GUEST_LIMITS.routesPerDay) return false;
  entry.routes.add(key);
  return true;
}

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
    const guest = ctx.sessionKey ?? `ip:${clientIp(request)}`;
    let underCeiling = true;
    for (let i = 0; i < cost; i++) underCeiling = guestRequests.take(guest).ok && underCeiling;
    if (!underCeiling || !countGuestRoute(guest, waypoints)) {
      throw new RoutingError(
        "rate_limited",
        `That's today's ${GUEST_LIMITS.routesPerDay} demo routes. Create a free account to keep planning — your drafts come with you.`,
      );
    }
  }
  return null;
}
