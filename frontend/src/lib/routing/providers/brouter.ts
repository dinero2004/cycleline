import { buildRoute, parseTags, type RawSegment } from "../metrics";
import { RoutingError, type Position, type RideProfile, type RoutePreferences } from "../types";
import type { ProviderRequest, RoutingProvider } from "./types";

interface BRouterResponse {
  features?: {
    properties: { "total-time"?: string; messages?: string[][] };
    geometry: { coordinates: [number, number, number?][] };
  }[];
}

/** BRouter profile for a ride profile and preferences (profiles available on brouter.de). */
export function brouterProfile(profile: RideProfile, prefs: RoutePreferences): string {
  switch (profile) {
    case "road":
      if (prefs.minimizeTraffic) return "fastbike-verylowtraffic";
      return prefs.avoidHighways || prefs.preferCycleways ? "fastbike-lowtraffic" : "fastbike";
    case "gravel":
      return prefs.surface === "paved" ? "trekking" : "gravel";
    case "mtb":
      return "mtb";
    case "ebike":
      return prefs.minimizeTraffic ? "fastbike-lowtraffic" : "trekking";
    case "commuter":
      return prefs.minimizeTraffic || prefs.preferCycleways ? "safety" : "trekking";
  }
}

/** Splits BRouter's per-way "messages" table into tagged segments. */
export function brouterSegments(messages: string[][] | undefined): RawSegment[] {
  if (!messages || messages.length < 2) return [];
  const header = messages[0];
  const distanceCol = header.indexOf("Distance");
  const tagsCol = header.indexOf("WayTags");
  return messages.slice(1).map((row) => ({
    lengthM: Number(row[distanceCol]) || 0,
    tags: parseTags(row[tagsCol] ?? ""),
  }));
}

export function parseBRouter(data: BRouterResponse, request: ProviderRequest, salt: string) {
  const feature = data.features?.[0];
  const raw = feature?.geometry?.coordinates;
  if (!feature || !raw?.length) throw new RoutingError("no_route", "No cycling path found between these points.");
  const coordinates: Position[] = raw.map(([lng, lat, ele]) => [lng, lat, ele ?? 0]);
  const totalTime = Number(feature.properties["total-time"]);
  return buildRoute({
    provider: "brouter",
    profile: request.profile,
    waypoints: request.waypoints,
    coordinates,
    rawSegments: brouterSegments(feature.properties.messages),
    providerDurationS: Number.isFinite(totalTime) ? totalTime : null,
    idSalt: salt,
  });
}

export function createBRouter(baseUrl = process.env.BROUTER_URL ?? "https://brouter.de/brouter"): RoutingProvider {
  return {
    name: "brouter",
    maxAlternative: 3,
    isConfigured: () => Boolean(baseUrl),
    async route(request, signal) {
      const profile = brouterProfile(request.profile, request.preferences);
      const url = new URL(baseUrl);
      url.searchParams.set("lonlats", request.waypoints.map(([lat, lng]) => `${lng},${lat}`).join("|"));
      url.searchParams.set("profile", profile);
      url.searchParams.set("alternativeidx", String(request.alternative));
      url.searchParams.set("format", "geojson");
      const response = await fetch(url, {
        signal,
        headers: { Accept: "application/geo+json, application/json", "User-Agent": "CycleLine/3.0 route planner" },
        cache: "no-store",
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        // BRouter answers 400 with "no track found" or "not mapped" when points can't be connected.
        if (response.status === 400 && /no track found|not mapped|position not mapped/i.test(text)) {
          throw new RoutingError("no_route", "No cycling path found between these points.");
        }
        throw new RoutingError("provider_unavailable", `BRouter answered ${response.status}.`);
      }
      return parseBRouter((await response.json()) as BRouterResponse, request, `${profile}:${request.alternative}`);
    },
  };
}
