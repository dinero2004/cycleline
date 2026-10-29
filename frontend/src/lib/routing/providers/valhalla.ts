import { lookupElevations } from "../elevation";
import { buildRoute, haversineM, type RawSegment } from "../metrics";
import { RoutingError, type LatLng, type Position, type RideProfile, type RoutePreferences } from "../types";
import type { RoutingProvider } from "./types";

/** Decodes Valhalla's precision-6 encoded polyline into [lat, lng]. */
export function decodePolyline6(encoded: string): LatLng[] {
  const out: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    out.push([lat / 1e6, lng / 1e6]);
  }
  return out;
}

const BICYCLE_TYPE: Record<RideProfile, string> = {
  road: "Road",
  gravel: "Cross",
  mtb: "Mountain",
  ebike: "Hybrid",
  commuter: "Hybrid",
};

export function valhallaCosting(profile: RideProfile, p: RoutePreferences) {
  return {
    bicycle: {
      bicycle_type: BICYCLE_TYPE[profile],
      use_roads: p.minimizeTraffic || p.avoidHighways ? 0.1 : p.preferCycleways ? 0.25 : 0.5,
      use_hills: p.maxGradePct !== undefined ? Math.min(1, Math.max(0, (p.maxGradePct - 3) / 12)) : 0.5,
      avoid_bad_surfaces: p.surface === "paved" || profile === "road" ? 0.9 : p.surface === "gravel" ? 0.1 : 0.4,
    },
  };
}

// Valhalla edge.surface values → OSM-like surface tags the classifier understands.
const SURFACE: Record<string, string> = {
  paved_smooth: "asphalt",
  paved: "paved",
  paved_rough: "sett",
  compacted: "compacted",
  dirt: "dirt",
  gravel: "gravel",
  path: "ground",
  impassable: "ground",
};
const ROAD_CLASS: Record<string, string> = {
  motorway: "motorway",
  trunk: "trunk",
  primary: "primary",
  secondary: "secondary",
  tertiary: "tertiary",
  unclassified: "unclassified",
  residential: "residential",
  service_other: "service",
};

interface ValhallaEdge {
  length: number;
  surface?: string;
  road_class?: string;
  use?: string;
  cycle_lane?: string;
}

export function createValhalla(baseUrl = process.env.VALHALLA_URL ?? "https://valhalla1.openstreetmap.de"): RoutingProvider {
  async function post<T>(path: string, body: unknown, signal: AbortSignal): Promise<T> {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/${path}`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", "User-Agent": "CycleLine/3.0 route planner" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as T & { error_code?: number; error?: string };
    if (!response.ok) {
      // 442 = no path, 171 = no suitable edges near a location.
      if (data.error_code === 442 || data.error_code === 171) throw new RoutingError("no_route", "No cycling path found between these points.");
      throw new RoutingError("provider_unavailable", `Valhalla answered ${response.status}.`);
    }
    return data;
  }

  return {
    name: "valhalla",
    maxAlternative: 2,
    isConfigured: () => Boolean(baseUrl),
    async route(request, signal) {
      const costing = valhallaCosting(request.profile, request.preferences);
      const routed = await post<{ trip?: { legs: { shape: string }[]; summary: { time: number } }; alternates?: { trip: { legs: { shape: string }[]; summary: { time: number } } }[] }>(
        "route",
        {
          locations: request.waypoints.map(([lat, lon]) => ({ lat, lon })),
          costing: "bicycle",
          costing_options: costing,
          alternates: request.alternative > 0 && request.waypoints.length === 2 ? request.alternative : undefined,
          directions_options: { units: "kilometers", directions_type: "none" },
        },
        signal,
      );
      const trip = request.alternative > 0 ? routed.alternates?.[request.alternative - 1]?.trip ?? routed.trip : routed.trip;
      if (!trip) throw new RoutingError("no_route", "No cycling path found between these points.");
      const line = trip.legs.flatMap((leg, i) => (i === 0 ? decodePolyline6(leg.shape) : decodePolyline6(leg.shape).slice(1)));

      // Surface and road class per edge, matched back onto the shape.
      const attributes = await post<{ edges?: ValhallaEdge[] }>(
        "trace_attributes",
        {
          shape: line.map(([lat, lon]) => ({ lat, lon })),
          costing: "bicycle",
          costing_options: costing,
          shape_match: "edge_walk",
          filters: { attributes: ["edge.length", "edge.surface", "edge.road_class", "edge.use", "edge.cycle_lane"], action: "include" },
        },
        signal,
      ).catch(() => ({ edges: [] as ValhallaEdge[] }));

      const rawSegments: RawSegment[] = (attributes.edges ?? []).map((edge) => {
        const tags: Record<string, string> = {};
        if (edge.surface && SURFACE[edge.surface]) tags.surface = SURFACE[edge.surface];
        if (edge.use === "cycleway") tags.highway = "cycleway";
        else if (edge.use === "path" || edge.use === "footway") tags.highway = "path";
        else if (edge.use === "track") tags.highway = "track";
        else if (edge.road_class && ROAD_CLASS[edge.road_class]) tags.highway = ROAD_CLASS[edge.road_class];
        if (edge.cycle_lane && edge.cycle_lane !== "none") tags.cycleway = edge.cycle_lane;
        return { lengthM: edge.length * 1000, tags };
      });

      // Valhalla routes carry no heights; look them up for the line.
      const elevations = await lookupElevations(line, signal).catch(() => line.map(() => 0));
      const coordinates: Position[] = line.map(([lat, lng], i) => [lng, lat, elevations[i]]);
      const lengthM = line.reduce((sum, p, i) => (i ? sum + haversineM(line[i - 1], p) : 0), 0);
      return buildRoute({
        provider: "valhalla",
        profile: request.profile,
        waypoints: request.waypoints,
        coordinates,
        rawSegments: rawSegments.length ? rawSegments : [{ lengthM, tags: {} }],
        providerDurationS: Math.round(trip.summary.time),
        idSalt: `valhalla:${request.alternative}`,
      });
    },
  };
}
