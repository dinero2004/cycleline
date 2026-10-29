import "server-only";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { GUEST_COOKIE, GUEST_LIMITS, verifyGuestId } from "@/lib/guest";
import { MAX_ROUTE_KM } from "@/lib/routing/schema";

export interface RequestContext {
  /** Signed-in user id, or the signed guest id, for per-session limits. */
  sessionKey: string | null;
  isGuest: boolean;
  userId: string | null;
  accessToken: string | null;
  maxRouteKm: number;
}

export async function requestContext(): Promise<RequestContext> {
  const session = await auth();
  if (session?.user && session.accessToken) {
    return { sessionKey: `u:${session.user.id}`, isGuest: false, userId: session.user.id, accessToken: session.accessToken, maxRouteKm: MAX_ROUTE_KM };
  }
  const guestId = await verifyGuestId((await cookies()).get(GUEST_COOKIE)?.value);
  return { sessionKey: guestId ? `g:${guestId}` : null, isGuest: true, userId: null, accessToken: null, maxRouteKm: GUEST_LIMITS.maxRouteKm };
}
