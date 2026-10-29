import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/brouter-zurich-baden.json";

// Guest by default; tests flip this to simulate a signed-in rider.
const ctx = { sessionKey: "g:test", isGuest: true, userId: null, accessToken: null, maxRouteKm: 80 };
vi.mock("@/lib/request-context", () => ({ requestContext: async () => ctx }));

const { POST: route } = await import("@/app/api/route/route");
const { POST: alternatives } = await import("@/app/api/route/alternatives/route");
const { POST: loop } = await import("@/app/api/route/loop/route");
const { POST: elevation } = await import("@/app/api/elevation/route");
const { POST: gpx } = await import("@/app/api/export/gpx/route");
const { GET: geocode } = await import("@/app/api/geocode/route");

const json = (body: unknown, ip = "10.0.0.1") =>
  new Request("http://test/api", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });

let ipCounter = 0;
const freshIp = () => `10.1.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;

/** Fake upstream: BRouter answers with the real fixture, Open-Meteo and Nominatim with canned data. */
function mockUpstream(handler?: (url: URL) => Response | undefined) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      const custom = handler?.(url);
      if (custom) return custom;
      if (url.hostname === "brouter.de") return Response.json(fixture);
      if (url.hostname === "api.open-meteo.com") {
        const n = url.searchParams.get("latitude")!.split(",").length;
        return Response.json({ elevation: Array.from({ length: n }, (_, i) => 400 + i) });
      }
      if (url.hostname === "nominatim.openstreetmap.org") {
        return Response.json([{ display_name: "Zürich, Switzerland", name: "Zürich", lat: "47.37", lon: "8.54", type: "city" }]);
      }
      return new Response("unexpected", { status: 500 });
    }),
  );
}

beforeEach(() => {
  ctx.isGuest = true;
  ctx.sessionKey = `g:${freshIp()}`;
  mockUpstream();
});
afterEach(() => vi.unstubAllGlobals());

const wps = [[47.3846, 8.5313], [47.4733, 8.3065]];

describe("POST /api/route", () => {
  it("returns a normalized Route", async () => {
    const res = await route(json({ waypoints: wps, profile: "commuter" }, freshIp()));
    expect(res.status).toBe(200);
    const { route: r } = await res.json();
    expect(r).toMatchObject({ provider: "brouter", profile: "commuter", geometry: { type: "LineString" } });
    expect(r.segments.length).toBeGreaterThan(0);
    expect(r.elevation.length).toBeGreaterThan(10);
    expect(Object.keys(r.surfaceMix)).toEqual(["paved", "gravel", "trail", "unknown"]);
  });

  it("accepts the original planner's request shape", async () => {
    const res = await route(json({ start: wps[0], end: wps[1], profile: "city", routeType: "round-trip" }, freshIp()));
    expect(res.status).toBe(200);
    expect((await res.json()).route.waypoints).toHaveLength(3);
  });

  it("rejects invalid input with a typed 422", async () => {
    const res = await route(json({ waypoints: [[47, 8]] }, freshIp()));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("invalid_request");
    const bad = await route(json({ waypoints: [[95, 8], [47, 8]] }, freshIp()));
    expect(bad.status).toBe(422);
  });

  it("caps waypoints", async () => {
    const many = Array.from({ length: 26 }, (_, i) => [47 + i * 0.001, 8.5]);
    expect((await route(json({ waypoints: many }, freshIp()))).status).toBe(422);
  });

  it("caps guest route length but not members'", async () => {
    const far = [[47.37, 8.54], [46.5, 7.5]];
    const res = await route(json({ waypoints: far }, freshIp()));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("too_long");
    Object.assign(ctx, { isGuest: false, maxRouteKm: 300, sessionKey: "u:1" });
    expect((await route(json({ waypoints: far }, freshIp()))).status).toBe(200);
  });

  it("maps 'no track found' to a friendly no_route error", async () => {
    mockUpstream((url) => (url.hostname === "brouter.de" ? new Response("no track found at pass=0", { status: 400 }) : undefined));
    const res = await route(json({ waypoints: [[47.1, 8.1], [47.2, 8.2]], profile: "road" }, freshIp()));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toEqual({ code: "no_route", message: "No cycling path found between these points." });
  });

  it("rate limits one IP", async () => {
    const ip = freshIp();
    let last = 200;
    for (let i = 0; i < 31; i++) {
      ctx.sessionKey = `g:${ip}:${i}`;
      last = (await route(json({ waypoints: [[47.3 + i * 0.001, 8.5], [47.31, 8.51]] }, ip))).status;
    }
    expect(last).toBe(429);
  });
});

describe("POST /api/route/alternatives and /loop", () => {
  it("returns ranked candidates with a reason", async () => {
    const res = await alternatives(json({ waypoints: [[47.38, 8.53], [47.47, 8.31]], profile: "road" }, freshIp()));
    expect(res.status).toBe(200);
    const { routes } = await res.json();
    expect(routes.length).toBeGreaterThanOrEqual(1);
    expect(routes[0]).toHaveProperty("score");
    expect(typeof routes[0].why).toBe("string");
  });

  it("validates loop distance", async () => {
    expect((await loop(json({ start: [47.37, 8.54], distanceKm: 2 }, freshIp()))).status).toBe(422);
    const ok = await loop(json({ start: [47.37, 8.54], distanceKm: 30, profile: "gravel" }, freshIp()));
    expect(ok.status).toBe(200);
  });
});

describe("POST /api/elevation", () => {
  it("densifies a short line and returns a profile", async () => {
    const res = await elevation(json({ coordinates: [[47.37, 8.54], [47.38, 8.55]] }, freshIp()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.length).toBeGreaterThan(10);
    expect(body.profile[0]).toEqual({ d: 0, e: 400 });
    expect(body.ascentM).toBeGreaterThan(0);
  });

  it("reports an upstream outage as 502", async () => {
    mockUpstream((url) => (url.hostname === "api.open-meteo.com" ? new Response("x", { status: 503 }) : undefined));
    const res = await elevation(json({ coordinates: [[47.1, 8.1], [47.11, 8.11]] }, freshIp()));
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("provider_unavailable");
  });
});

describe("GET /api/geocode", () => {
  it("returns results and the legacy first match", async () => {
    const { NextRequest } = await import("next/server");
    const res = await geocode(new NextRequest("http://test/api/geocode?q=Zurich&limit=3", { headers: { "x-forwarded-for": freshIp() } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.coordinates).toEqual([47.37, 8.54]);
    expect(body.results[0]).toMatchObject({ name: "Zürich", label: "Zürich, Switzerland" });
  });
});

describe("POST /api/export/gpx", () => {
  const body = { name: "Lake loop", coordinates: [[8.5, 47.3, 400], [8.51, 47.31, 410]] };

  it("watermarks guest exports only", async () => {
    const guest = await (await gpx(json(body))).text();
    expect(guest).toContain("guest demo");
    Object.assign(ctx, { isGuest: false });
    const member = await gpx(json(body));
    expect(member.headers.get("content-disposition")).toContain('filename="lake-loop.gpx"');
    expect(await member.text()).not.toContain("guest demo");
  });
});
