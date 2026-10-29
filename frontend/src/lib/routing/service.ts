import { TtlCache } from "../cache";
import { fnv1a } from "./metrics";
import { createBRouter } from "./providers/brouter";
import { createGraphHopper } from "./providers/graphhopper";
import type { ProviderRequest, RoutingProvider } from "./providers/types";
import { createValhalla } from "./providers/valhalla";
import { dedupeRoutes, rankRoutes } from "./scoring";
import type { LoopRequest, RouteRequest } from "./schema";
import { RoutingError, type LatLng, type RankedRoute, type Route } from "./types";

export interface ServiceOptions {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  cache?: TtlCache<Route>;
  log?: (entry: Record<string, unknown>) => void;
}

const defaultLog = (entry: Record<string, unknown>) => console.info(JSON.stringify({ at: "routing", ...entry }));

/** Point reached by going distanceM from start on a compass bearing (spherical earth). */
export function destination([lat, lng]: LatLng, bearingDeg: number, distanceM: number): LatLng {
  const r = 6_371_000;
  const rad = Math.PI / 180;
  const d = distanceM / r;
  const b = bearingDeg * rad;
  const lat1 = lat * rad;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lng2 = lng * rad + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return [Math.round((lat2 / rad) * 1e6) / 1e6, Math.round((((lng2 / rad + 540) % 360) - 180) * 1e6) / 1e6];
}

/**
 * Triangle loop: start → two points either side of the bearing → start. Roads add roughly a quarter
 * to the straight-line distance, so the triangle is sized for distance / 1.25.
 */
export function loopWaypoints(start: LatLng, distanceKm: number, bearing: number): LatLng[] {
  const radiusM = (distanceKm * 1000) / 1.25 / 3;
  return [start, destination(start, bearing - 30, radiusM), destination(start, bearing + 30, radiusM), start];
}

export class RoutingService {
  private readonly cache: TtlCache<Route>;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly backoffMs: number;
  private readonly log: (entry: Record<string, unknown>) => void;

  constructor(
    private readonly providers: RoutingProvider[],
    options: ServiceOptions = {},
  ) {
    this.cache = options.cache ?? new TtlCache<Route>(500, 60 * 60 * 1000);
    this.timeoutMs = options.timeoutMs ?? 12_000;
    this.retries = options.retries ?? 1;
    this.backoffMs = options.backoffMs ?? 400;
    this.log = options.log ?? defaultLog;
  }

  get providerNames() {
    return this.providers.filter((p) => p.isConfigured()).map((p) => p.name);
  }

  /** One route through the waypoints from the first provider that answers. */
  async route(request: RouteRequest, alternative = 0): Promise<Route> {
    const providerRequest: ProviderRequest = { ...request, alternative };
    const key = fnv1a(JSON.stringify([request.waypoints, request.profile, request.preferences, alternative]));
    const cached = this.cache.get(key);
    if (cached) return cached;

    let lastError: RoutingError | null = null;
    for (const provider of this.providers.filter((p) => p.isConfigured())) {
      if (alternative > provider.maxAlternative) continue;
      try {
        const route = await this.callWithRetry(provider, providerRequest);
        this.cache.set(key, route);
        return route;
      } catch (error) {
        const routingError = error instanceof RoutingError ? error : new RoutingError("provider_unavailable", "Routing failed.");
        // A provider that finds no path is an answer, not an outage: don't ask the next one.
        if (routingError.code === "no_route") throw routingError;
        lastError = routingError;
      }
    }
    throw lastError ?? new RoutingError("provider_unavailable", "No routing provider is configured.");
  }

  /** Up to three distinct candidates (provider alternatives plus a quieter variant), ranked. */
  async alternatives(request: RouteRequest): Promise<RankedRoute[]> {
    const variants: [RouteRequest, number][] = [
      [request, 0],
      [request, 1],
      [request, 2],
      [{ ...request, preferences: { ...request.preferences, minimizeTraffic: !request.preferences.minimizeTraffic } }, 0],
    ];
    const settled = await Promise.allSettled(variants.map(([r, alt]) => this.route(r, alt)));
    const routes = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
    if (routes.length === 0) {
      const first = settled.find((s): s is PromiseRejectedResult => s.status === "rejected");
      throw first?.reason instanceof RoutingError ? first.reason : new RoutingError("provider_unavailable", "Routing failed.");
    }
    return rankRoutes(dedupeRoutes(routes), { fitness: request.fitness, preferences: request.preferences }).slice(0, 3);
  }

  /** Round trips of roughly the target distance in a few directions, ranked by fit. */
  async loop(request: LoopRequest): Promise<RankedRoute[]> {
    const bearings = request.bearing === undefined ? [0, 120, 240] : [request.bearing - 35, request.bearing, request.bearing + 35];
    const settled = await Promise.allSettled(
      bearings.map((b) =>
        this.route({
          waypoints: loopWaypoints(request.start, request.distanceKm, (b + 360) % 360),
          profile: request.profile,
          preferences: request.preferences,
          fitness: request.fitness,
        }),
      ),
    );
    const all = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
    if (all.length === 0) throw new RoutingError("no_route", "No round trip could be found from this start point.");
    // Drop loops that came out far from the target when closer ones exist.
    const target = request.distanceKm * 1000;
    const close = all.filter((r) => Math.abs(r.distanceM / target - 1) <= 0.35);
    const routes = close.length ? close : all;
    return rankRoutes(dedupeRoutes(routes), {
      fitness: request.fitness,
      preferences: request.preferences,
      targetDistanceM: request.distanceKm * 1000,
    }).slice(0, 3);
  }

  private async callWithRetry(provider: RoutingProvider, request: ProviderRequest): Promise<Route> {
    for (let attempt = 0; ; attempt++) {
      const started = Date.now();
      try {
        const route = await provider.route(request, AbortSignal.timeout(this.timeoutMs));
        this.log({ provider: provider.name, ok: true, ms: Date.now() - started, attempt, points: request.waypoints.length });
        return route;
      } catch (error) {
        const routingError =
          error instanceof RoutingError
            ? error
            : error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
              ? new RoutingError("timeout", "The routing service took too long to answer.")
              : new RoutingError("provider_unavailable", "The routing service could not be reached.");
        this.log({ provider: provider.name, ok: false, ms: Date.now() - started, attempt, code: routingError.code });
        const retryable = routingError.code === "provider_unavailable" || routingError.code === "timeout";
        if (!retryable || attempt >= this.retries) throw routingError;
        await new Promise((resolve) => setTimeout(resolve, this.backoffMs * 2 ** attempt));
      }
    }
  }
}

const FACTORIES: Record<string, () => RoutingProvider> = {
  brouter: () => createBRouter(),
  graphhopper: () => createGraphHopper(),
  valhalla: () => createValhalla(),
};

let shared: RoutingService | null = null;

/** The app-wide service; ROUTING_PROVIDERS sets the order of the fallback chain. */
export function routingService(): RoutingService {
  if (!shared) {
    const order = (process.env.ROUTING_PROVIDERS ?? "brouter,graphhopper,valhalla")
      .split(",")
      .map((name) => name.trim())
      .filter((name) => FACTORIES[name]);
    shared = new RoutingService(order.map((name) => FACTORIES[name]()));
  }
  return shared;
}
