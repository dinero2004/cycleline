import { describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/brouter-zurich-baden.json";
import { parseBRouter } from "@/lib/routing/providers/brouter";
import type { RoutingProvider } from "@/lib/routing/providers/types";
import { destination, loopWaypoints, RoutingService } from "@/lib/routing/service";
import { haversineM } from "@/lib/routing/metrics";
import { RoutingError } from "@/lib/routing/types";

const request = {
  waypoints: [[47.3846, 8.5313], [47.4733, 8.3065]] as [number, number][],
  profile: "commuter" as const,
  preferences: {},
  fitness: "intermediate" as const,
};
const realRoute = parseBRouter(fixture as never, { ...request, alternative: 0 }, "t");

function provider(name: string, impl: RoutingProvider["route"]): RoutingProvider & { route: ReturnType<typeof vi.fn> } {
  return { name, maxAlternative: 3, isConfigured: () => true, route: vi.fn(impl) };
}

const quiet = { log: () => {}, backoffMs: 1 };

describe("RoutingService", () => {
  it("falls back to the next provider when one is down", async () => {
    const down = provider("a", async () => {
      throw new RoutingError("provider_unavailable", "down");
    });
    const up = provider("b", async () => ({ ...realRoute, provider: "b" }));
    const route = await new RoutingService([down, up], quiet).route(request);
    expect(route.provider).toBe("b");
    expect(down.route).toHaveBeenCalledTimes(2); // first try + one retry
  });

  it("does not ask other providers when the first finds no path", async () => {
    const none = provider("a", async () => {
      throw new RoutingError("no_route", "No cycling path found between these points.");
    });
    const other = provider("b", async () => realRoute);
    await expect(new RoutingService([none, other], quiet).route(request)).rejects.toMatchObject({ code: "no_route" });
    expect(other.route).not.toHaveBeenCalled();
  });

  it("turns a slow provider into a timeout error", async () => {
    const slow = provider("a", (_req, signal) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason))));
    await expect(new RoutingService([slow], { ...quiet, timeoutMs: 20, retries: 0 }).route(request)).rejects.toMatchObject({ code: "timeout" });
  });

  it("caches by waypoints and preferences", async () => {
    const p = provider("a", async () => realRoute);
    const service = new RoutingService([p], quiet);
    await service.route(request);
    await service.route(request);
    expect(p.route).toHaveBeenCalledTimes(1);
    await service.route({ ...request, preferences: { minimizeTraffic: true } });
    expect(p.route).toHaveBeenCalledTimes(2);
  });

  it("skips providers that are not configured", async () => {
    const off = { ...provider("a", async () => realRoute), isConfigured: () => false };
    const on = provider("b", async () => ({ ...realRoute, provider: "b" }));
    const service = new RoutingService([off, on], quiet);
    expect(service.providerNames).toEqual(["b"]);
    expect((await service.route(request)).provider).toBe("b");
  });

  it("returns ranked, de-duplicated alternatives", async () => {
    const p = provider("a", async (req) => ({ ...realRoute, id: `r${req.alternative}`, distanceM: realRoute.distanceM + req.alternative * 900 }));
    const routes = await new RoutingService([p], quiet).alternatives(request);
    expect(routes.length).toBeGreaterThan(1);
    expect(routes.length).toBeLessThanOrEqual(3);
    expect(routes[0].score).toBeGreaterThanOrEqual(routes[1].score);
    expect(routes.every((r) => r.why.endsWith("."))).toBe(true);
  });
});

describe("loop geometry", () => {
  it("projects a point at the right distance and bearing", () => {
    const start: [number, number] = [47.37, 8.54];
    const north = destination(start, 0, 10_000);
    expect(haversineM(start, north)).toBeCloseTo(10_000, -1);
    expect(north[0]).toBeGreaterThan(start[0]);
  });

  it("builds a closed triangle sized for the target distance", () => {
    const wps = loopWaypoints([47.37, 8.54], 60, 90);
    expect(wps).toHaveLength(4);
    expect(wps[0]).toEqual(wps[3]);
    const straight = haversineM(wps[0], wps[1]) + haversineM(wps[1], wps[2]) + haversineM(wps[2], wps[3]);
    expect(straight / 1000).toBeCloseTo(60 / 1.25, 0);
  });
});
