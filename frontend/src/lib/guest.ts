/**
 * Guest demo: an anonymous id in a signed cookie, plus the limits guests get.
 * Every limit is configurable with an env var.
 */
export const GUEST_COOKIE = "cl_guest";

export const GUEST_LIMITS = {
  /** Routes a guest can calculate per day. */
  routesPerDay: Number(process.env.GUEST_ROUTES_PER_DAY ?? 20),
  /** Longest route a guest can plan (straight-line sum between waypoints). */
  maxRouteKm: Number(process.env.GUEST_MAX_ROUTE_KM ?? 80),
  /** AI assistant messages per day. */
  aiMessagesPerDay: Number(process.env.GUEST_AI_MESSAGES_PER_DAY ?? 8),
  /** Signed-in riders' AI messages per day. */
  memberAiMessagesPerDay: Number(process.env.MEMBER_AI_MESSAGES_PER_DAY ?? 60),
};

export const GUEST_GPX_NOTE = "Planned in the CycleLine guest demo — create a free account to save routes and export without this note.";

const encoder = new TextEncoder();

async function hmac(value: string): Promise<string> {
  const secret = process.env.AUTH_SECRET ?? "cycleline-development-secret";
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`guest:${value}`));
  return Buffer.from(signature).toString("base64url").slice(0, 32);
}

/** "<id>.<signature>" for the cookie. */
export async function signGuestId(id: string): Promise<string> {
  return `${id}.${await hmac(id)}`;
}

/** The guest id when the cookie's signature checks out, else null. */
export async function verifyGuestId(cookie: string | undefined): Promise<string | null> {
  if (!cookie) return null;
  const dot = cookie.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = cookie.slice(0, dot);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(id)) return null;
  return (await hmac(id)) === cookie.slice(dot + 1) ? id : null;
}

export function newGuestId(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString("base64url");
}
