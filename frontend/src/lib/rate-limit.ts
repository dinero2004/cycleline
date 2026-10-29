import type { NextRequest } from "next/server";

/**
 * Fixed-window rate limiter kept in memory (per server instance). Good enough for one
 * container; use a shared store (Redis) behind a load balancer.
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Records one hit; returns whether it is allowed and when the window resets. */
  take(key: string, now = Date.now()): { ok: boolean; remaining: number; resetAt: number } {
    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.hits.set(key, entry);
      if (this.hits.size > 10_000) this.sweep(now);
    }
    entry.count += 1;
    return { ok: entry.count <= this.limit, remaining: Math.max(0, this.limit - entry.count), resetAt: entry.resetAt };
  }

  private sweep(now: number) {
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
  }
}

/** Client IP from the proxy headers (Traefik/nginx set x-forwarded-for), else a constant. */
export function clientIp(request: NextRequest | Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

const limiters = {
  routing: new RateLimiter(Number(process.env.RATE_LIMIT_ROUTING_PER_MIN ?? 30), 60_000),
  geocode: new RateLimiter(Number(process.env.RATE_LIMIT_GEOCODE_PER_MIN ?? 60), 60_000),
};

/** Checks both the IP and (when present) the session/guest id; either one running out blocks. */
export function checkRate(kind: keyof typeof limiters, request: NextRequest | Request, sessionKey?: string | null) {
  const byIp = limiters[kind].take(`ip:${clientIp(request)}`);
  const bySession = sessionKey ? limiters[kind].take(`s:${sessionKey}`) : byIp;
  return byIp.ok && bySession.ok ? null : Math.ceil((Math.max(byIp.resetAt, bySession.resetAt) - Date.now()) / 1000);
}
