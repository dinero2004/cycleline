import "server-only";

import { z } from "zod";
import { backendFetch } from "@/lib/backend";
import { searchPlaces } from "@/lib/geocode";
import { GUEST_LIMITS } from "@/lib/guest";
import { difficulty, distanceAtPoint, estimateDurationS, formatDuration, haversineM, surfacePercentages } from "@/lib/routing/metrics";
import { MAX_ROUTE_KM, straightLineKm } from "@/lib/routing/schema";
import { routingService } from "@/lib/routing/service";
import { simplifyRoute } from "@/lib/routing/simplify";
import { RoutingError, type LatLng, type RankedRoute, type RoutePreferences } from "@/lib/routing/types";
import { toBackendRoute } from "@/lib/studio";
import { cleanName } from "./guard";
import type { ConversationState, Place, RouteCard, ToolContext, ToolResult } from "./types";

// Small models often send numbers and booleans as strings ("40", "true"); accept and convert them.
const num = () => z.coerce.number();
const bool = () => z.preprocess((v) => (v === "true" ? true : v === "false" ? false : v), z.boolean());
const profileEnum = z.enum(["road", "gravel", "mtb", "ebike", "commuter"]);
const preferencesSchema = z
  .object({
    maxGradePct: num().pipe(z.number().min(2).max(30)).optional(),
    surface: z.enum(["paved", "mixed", "gravel"]).optional(),
    minimizeTraffic: bool().optional(),
    preferCycleways: bool().optional(),
    avoidHighways: bool().optional(),
  })
  .optional();
// A place id from geocode/studio_context, or a place name the server looks up (helps smaller models).
const placeRef = z.string().trim().min(2).max(120);
const PLACE_ID = /^(p\d{1,4}(_\d)?|current_\d{1,2})$/;
// A route id, or "option 2" / "2" for the latest batch of options.
const routeRef = z.coerce.string().trim().min(1).max(20);

const PREFERENCES_JSON = {
  type: "object",
  description: "Optional routing preferences.",
  properties: {
    maxGradePct: { type: "number", description: "Steepest acceptable grade in percent (2–30)." },
    surface: { type: "string", enum: ["paved", "mixed", "gravel"] },
    minimizeTraffic: { type: "boolean", description: "Prefer quiet roads." },
    preferCycleways: { type: "boolean" },
    avoidHighways: { type: "boolean" },
  },
  additionalProperties: false,
} as const;

const PROFILE_JSON = {
  type: "string",
  enum: ["road", "gravel", "mtb", "ebike", "commuter"],
  description: "Ride profile. Defaults to the rider's profile from studio_context.",
} as const;

// --- state helpers ------------------------------------------------------------

function addPlace(state: ConversationState, name: string, label: string, point: LatLng, fixedId?: string): Place {
  // Places found other ways (POIs, looked-up names) get ids after the geocode range.
  const id = fixedId ?? `p${100 + ++state.placeCounter}`;
  const place = { id, name: cleanName(name, 80), label: cleanName(label, 160), point };
  state.places.set(id, place);
  return place;
}

/** Place ids resolve from the conversation; anything else is treated as a name and geocoded (top match). */
async function resolvePlaces(state: ConversationState, refs: string[], signal: AbortSignal): Promise<Place[]> {
  return Promise.all(
    refs.map(async (ref) => {
      const known = state.places.get(ref);
      if (known) return known;
      if (PLACE_ID.test(ref)) {
        const known = [...state.places.values()].map((p) => `${p.id} (${p.name})`).join(", ");
        throw new RoutingError(
          "invalid_request",
          `Unknown place id ${ref}. ${known ? `Known places: ${known}.` : "No places yet."} Call geocode with the place name the rider gave, then use the id it returns.`,
        );
      }
      // Only look up names the rider actually wrote; anything else is the model guessing.
      if (!state.riderText.includes(ref.toLowerCase())) {
        throw new RoutingError("invalid_request", `"${cleanName(ref, 60)}" is not a place the rider mentioned. Call geocode with the place name they gave.`);
      }
      const [match] = await searchPlaces(ref, 1, signal).catch(() => []);
      if (!match) throw new RoutingError("invalid_request", `No place found for "${cleanName(ref, 60)}". Try a more specific name.`);
      return addPlace(state, match.name, match.label, match.coordinates);
    }),
  );
}

function getRoute(state: ConversationState, ref: string): RankedRoute {
  const option = /^(?:option\s*)?(\d)$/i.exec(ref);
  const id = option ? state.lastBatch[Number(option[1]) - 1] : ref;
  const route = id ? state.routes.get(id) : undefined;
  if (!route) {
    throw new RoutingError(
      "invalid_request",
      state.lastBatch.length
        ? `Unknown route ${ref}. Current options: ${state.lastBatch.map((r, i) => `${r} (option ${i + 1})`).join(", ")}.`
        : "No routes planned yet. Call plan_route or plan_loop first.",
    );
  }
  return route;
}

function rememberRoutes(state: ConversationState, routes: RankedRoute[]) {
  state.lastBatch = routes.map((r) => r.id);
  routes.forEach((r, i) => {
    state.routes.set(r.id, r);
    state.ranks.set(r.id, i + 1);
  });
  // Keep the most recent 30 so long chats don't grow without bound.
  while (state.routes.size > 30) state.routes.delete(state.routes.keys().next().value as string);
}

function checkLength(ctx: ToolContext, points: LatLng[]) {
  const cap = ctx.isGuest ? GUEST_LIMITS.maxRouteKm : MAX_ROUTE_KM;
  if (straightLineKm(points) > cap) {
    throw new RoutingError("too_long", ctx.isGuest ? `Guest routes are limited to about ${cap} km.` : `Routes are limited to about ${cap} km.`);
  }
}

const km = (m: number) => Math.round(m / 100) / 10;

/** Compact summary the model reads: numbers it may quote, no geometry. */
function summarize(route: RankedRoute, state: ConversationState, rank?: number) {
  const pct = surfacePercentages(route.surfaceMix);
  return {
    route_id: route.id,
    ...(rank ? { rank } : {}),
    distance_km: km(route.distanceM),
    ascent_m: route.ascentM,
    descent_m: route.descentM,
    max_grade_pct: route.maxGradePct,
    avg_climb_grade_pct: route.avgGradePct,
    ride_time: formatDuration(estimateDurationS(route, state.fitness)),
    ride_time_fitness: state.fitness,
    difficulty: difficulty(route).level,
    surface_pct: pct,
    surface_inferred_km: km(route.inferredSurfaceM),
    warnings: route.warnings.slice(0, 5).map((w) => w.message),
    why: route.why,
  };
}

function cards(routes: RankedRoute[], title: (i: number) => string): RouteCard[] {
  return routes.map((route, i) => ({ rank: i + 1, title: title(i), why: route.why, route: simplifyRoute(route, 4) }));
}

// --- tools --------------------------------------------------------------------

export interface ToolSpec {
  name: string;
  description: string;
  schema: z.ZodType;
  jsonSchema: Record<string, unknown>;
  label: (input: never) => string;
  run: (input: never, ctx: ToolContext) => Promise<unknown>;
}

function tool<S extends z.ZodType>(spec: {
  name: string;
  description: string;
  schema: S;
  jsonSchema: Record<string, unknown>;
  label: (input: z.infer<S>) => string;
  run: (input: z.infer<S>, ctx: ToolContext) => Promise<unknown>;
}): ToolSpec {
  return spec as unknown as ToolSpec;
}

export const TOOLS: ToolSpec[] = [
  tool({
    name: "geocode",
    description: "Search for a place (town, address, landmark, station). Returns up to 5 matches with place ids to use in other tools.",
    schema: z.object({ query: z.string().trim().min(2).max(120) }).strip(),
    jsonSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Place name, e.g. 'Munich' or 'Zürich HB'." } },
      required: ["query"],
      additionalProperties: false,
    },
    label: ({ query }) => `Looking up ${cleanName(query, 40)}`,
    async run({ query }, ctx) {
      const results = await searchPlaces(query, 5, ctx.signal).catch((error) => {
        if (error instanceof RoutingError && error.code === "no_route") return [];
        throw error;
      });
      // The n-th geocode call's best match is always p{n}; other matches are p{n}_2 … p{n}_5.
      const n = ++ctx.state.geocodeCount;
      return {
        places: results.map((r, i) => {
          const place = addPlace(ctx.state, r.name, r.label, r.coordinates, i === 0 ? `p${n}` : `p${n}_${i + 1}`);
          return { place_id: place.id, name: place.name, full_name: place.label };
        }),
      };
    },
  }),

  tool({
    name: "plan_route",
    description:
      "Plan a route from the first place to the last, via any places in between. Returns 2–3 ranked options; the rider sees them as cards.",
    schema: z
      .object({
        place_ids: z.array(placeRef).min(2).max(10),
        profile: profileEnum.optional(),
        preferences: preferencesSchema,
      })
      .strip(),
    jsonSchema: {
      type: "object",
      properties: {
        place_ids: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 10, description: "Start, optional vias, finish: place ids from geocode (or place names)." },
        profile: PROFILE_JSON,
        preferences: PREFERENCES_JSON,
      },
      required: ["place_ids"],
      additionalProperties: false,
    },
    label: () => "Planning routes",
    async run({ place_ids, profile, preferences }, ctx) {
      const places = await resolvePlaces(ctx.state, place_ids, ctx.signal);
      const waypoints = places.map((p) => p.point);
      checkLength(ctx, waypoints);
      const routes = await routingService().alternatives({
        waypoints,
        profile: profile ?? ctx.state.profile,
        preferences: (preferences ?? {}) as RoutePreferences,
        fitness: ctx.state.fitness,
      });
      rememberRoutes(ctx.state, routes);
      const from = places[0].name;
      const to = places[places.length - 1].name;
      ctx.emit({ type: "routes", routes: cards(routes, (i) => `${from} → ${to} · option ${i + 1}`) });
      return { options: routes.map((r, i) => summarize(r, ctx.state, i + 1)) };
    },
  }),

  tool({
    name: "plan_loop",
    description: "Plan a round trip of about distance_km from a start place. Returns 2–3 ranked loops as cards.",
    schema: z
      .object({
        start_place_id: placeRef,
        distance_km: num().pipe(z.number().min(5).max(200)),
        direction: z.enum(["north", "east", "south", "west", "any"]).optional(),
        profile: profileEnum.optional(),
        preferences: preferencesSchema,
      })
      .strip(),
    jsonSchema: {
      type: "object",
      properties: {
        start_place_id: { type: "string", description: "Place id from geocode (or a place name)." },
        distance_km: { type: "number", description: "Target length, 5–200 km." },
        direction: { type: "string", enum: ["north", "east", "south", "west", "any"] },
        profile: PROFILE_JSON,
        preferences: PREFERENCES_JSON,
      },
      required: ["start_place_id", "distance_km"],
      additionalProperties: false,
    },
    label: ({ distance_km }) => `Planning ${Math.round(distance_km)} km loops`,
    async run({ start_place_id, distance_km, direction, profile, preferences }, ctx) {
      const [start] = await resolvePlaces(ctx.state, [start_place_id], ctx.signal);
      const cap = ctx.isGuest ? GUEST_LIMITS.maxRouteKm : MAX_ROUTE_KM;
      if (distance_km > cap) throw new RoutingError("too_long", `Loops are limited to about ${cap} km${ctx.isGuest ? " for guests" : ""}.`);
      const bearing = { north: 0, east: 90, south: 180, west: 270, any: undefined }[direction ?? "any"];
      const routes = await routingService().loop({
        start: start.point,
        distanceKm: distance_km,
        bearing,
        profile: profile ?? ctx.state.profile,
        preferences: (preferences ?? {}) as RoutePreferences,
        fitness: ctx.state.fitness,
      });
      rememberRoutes(ctx.state, routes);
      ctx.emit({ type: "routes", routes: cards(routes, (i) => `${Math.round(distance_km)} km loop from ${start.name} · option ${i + 1}`) });
      return { options: routes.map((r, i) => summarize(r, ctx.state, i + 1)) };
    },
  }),

  tool({
    name: "get_elevation_profile",
    description: "Elevation profile of a planned route: 20 samples and the main climbs.",
    schema: z.object({ route_id: routeRef }).strip(),
    jsonSchema: { type: "object", properties: { route_id: { type: "string" } }, required: ["route_id"], additionalProperties: false },
    label: () => "Reading the elevation profile",
    async run({ route_id }, ctx) {
      const route = getRoute(ctx.state, route_id);
      const step = Math.max(1, Math.floor(route.elevation.length / 20));
      const samples = route.elevation.filter((_, i) => i % step === 0).map((p) => ({ at_km: km(p.d), elevation_m: Math.round(p.e) }));
      const climbs = route.segments
        .filter((s) => s.gradePct >= 4 && s.endM - s.startM >= 300)
        .sort((a, b) => b.gradePct * (b.endM - b.startM) - a.gradePct * (a.endM - a.startM))
        .slice(0, 5)
        .map((s) => ({ from_km: km(s.startM), to_km: km(s.endM), avg_grade_pct: s.gradePct }));
      return { ...summarize(route, ctx.state), samples, climbs };
    },
  }),

  tool({
    name: "compare_routes",
    description: "Side-by-side numbers for up to 4 planned routes.",
    schema: z.object({ route_ids: z.array(routeRef).min(2).max(4) }).strip(),
    jsonSchema: {
      type: "object",
      properties: { route_ids: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 } },
      required: ["route_ids"],
      additionalProperties: false,
    },
    label: () => "Comparing routes",
    async run({ route_ids }, ctx) {
      return { routes: route_ids.map((id) => summarize(getRoute(ctx.state, id), ctx.state)) };
    },
  }),

  tool({
    name: "find_pois",
    description:
      "Points of interest within 300 m of a planned route: drinking water, cafes, bike shops. Each result gets a place id you can route via.",
    schema: z.object({ route_id: routeRef, categories: z.array(z.enum(["water", "cafe", "bike_shop"])).min(1).max(3) }).strip(),
    jsonSchema: {
      type: "object",
      properties: {
        route_id: { type: "string" },
        categories: { type: "array", items: { type: "string", enum: ["water", "cafe", "bike_shop"] }, minItems: 1, maxItems: 3 },
      },
      required: ["route_id", "categories"],
      additionalProperties: false,
    },
    label: ({ categories }) => `Finding ${categories.join(", ").replace("bike_shop", "bike shops")}`,
    async run({ route_id, categories }, ctx) {
      const route = getRoute(ctx.state, route_id);
      const line = route.geometry.coordinates;
      const step = Math.max(1, Math.floor(line.length / 40));
      const around = line.filter((_, i) => i % step === 0).map(([lng, lat]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(",");
      const filters = { water: '["amenity"="drinking_water"]', cafe: '["amenity"="cafe"]', bike_shop: '["shop"="bicycle"]' };
      const query = `[out:json][timeout:15];(${categories.map((c) => `node(around:300,${around})${filters[c]};`).join("")});out body 40;`;
      const response = await fetch(process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: new URLSearchParams({ data: query }),
        signal: ctx.signal,
        headers: { "User-Agent": "CycleLine/3.0 route planner" },
      });
      if (!response.ok) throw new RoutingError("provider_unavailable", "The points-of-interest service is busy. Try again in a minute.");
      const data = (await response.json()) as { elements?: { lat: number; lon: number; tags?: Record<string, string> }[] };
      const category = (tags: Record<string, string> = {}) =>
        tags.amenity === "drinking_water" ? "water" : tags.amenity === "cafe" ? "cafe" : "bike_shop";
      const pois = (data.elements ?? [])
        .map((el) => {
          const point: LatLng = [el.lat, el.lon];
          const along = distanceAtPoint(route, point);
          const nearest = line.reduce((best, [lng, lat]) => Math.min(best, haversineM(point, [lat, lng])), Infinity);
          return { el, point, along, off: nearest };
        })
        .sort((a, b) => a.along - b.along)
        .slice(0, 15)
        .map(({ el, point, along, off }) => {
          const kind = category(el.tags);
          const name = el.tags?.name ?? (kind === "water" ? "Drinking water" : kind === "cafe" ? "Cafe" : "Bike shop");
          const place = addPlace(ctx.state, name, name, point);
          return { place_id: place.id, name: place.name, category: kind, at_km: km(along), off_route_m: Math.round(off) };
        });
      return { route_id, pois, note: pois.length ? undefined : "No mapped places of these kinds near the route." };
    },
  }),

  tool({
    name: "get_weather",
    description: "Hourly forecast (temperature, rain chance, wind) for a place at a time within the next 7 days.",
    schema: z.object({ place_id: placeRef, time: z.string().datetime({ offset: true }).optional() }).strip(),
    jsonSchema: {
      type: "object",
      properties: {
        place_id: { type: "string" },
        time: { type: "string", description: "ISO 8601 date-time with offset; omit for now." },
      },
      required: ["place_id"],
      additionalProperties: false,
    },
    label: () => "Checking the forecast",
    async run({ place_id, time }, ctx) {
      const [place] = await resolvePlaces(ctx.state, [place_id], ctx.signal);
      const when = time ? new Date(time) : new Date();
      if (when.getTime() - Date.now() > 7 * 24 * 3600 * 1000) return { note: "Forecasts only reach 7 days ahead." };
      const url = new URL(process.env.FORECAST_URL ?? "https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", place.point[0].toFixed(4));
      url.searchParams.set("longitude", place.point[1].toFixed(4));
      url.searchParams.set("hourly", "temperature_2m,precipitation_probability,wind_speed_10m");
      url.searchParams.set("timezone", "UTC");
      url.searchParams.set("forecast_days", "7");
      const response = await fetch(url, { signal: ctx.signal });
      if (!response.ok) throw new RoutingError("provider_unavailable", "The forecast service is unavailable.");
      const data = (await response.json()) as {
        hourly?: { time: string[]; temperature_2m: number[]; precipitation_probability: number[]; wind_speed_10m: number[] };
      };
      const hourly = data.hourly;
      if (!hourly?.time.length) return { note: "No forecast available." };
      const target = when.toISOString().slice(0, 13);
      const i = Math.max(0, hourly.time.findIndex((t) => t.startsWith(target)));
      return {
        place: place.name,
        time_utc: hourly.time[i],
        temperature_c: hourly.temperature_2m[i],
        rain_chance_pct: hourly.precipitation_probability[i],
        wind_kmh: hourly.wind_speed_10m[i],
        source: "Open-Meteo",
      };
    },
  }),

  tool({
    name: "save_route",
    description: "Save a planned route to the rider's library. Guests are offered a free account instead.",
    schema: z.object({ route_id: routeRef, name: z.string().trim().min(3).max(120) }).strip(),
    jsonSchema: {
      type: "object",
      properties: { route_id: { type: "string" }, name: { type: "string", description: "Short route name." } },
      required: ["route_id", "name"],
      additionalProperties: false,
    },
    label: () => "Saving the route",
    async run({ route_id, name }, ctx) {
      const route = getRoute(ctx.state, route_id);
      if (ctx.isGuest || !ctx.accessToken) {
        ctx.emit({ type: "signup", reason: "save" });
        return { saved: false, reason: "The rider is not signed in. The app is showing a free sign-up; drafts carry over." };
      }
      const placeName = (point: LatLng) =>
        [...ctx.state.places.values()].find((p) => haversineM(p.point, point) < 30)?.name ?? "Start";
      await backendFetch("routes", {
        method: "POST",
        token: ctx.accessToken,
        body: toBackendRoute({
          name: cleanName(name),
          startName: placeName(route.waypoints[0]),
          endName: placeName(route.waypoints[route.waypoints.length - 1]),
          bikeId: null,
          route,
          fitness: ctx.state.fitness,
        }),
      });
      return { saved: true, name: cleanName(name) };
    },
  }),
];

export const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

/** Validates the model's arguments and runs one tool. Errors become a tool result the model can read. */
export async function runTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolResult> {
  const spec = TOOL_BY_NAME.get(name);
  if (!spec) return { content: JSON.stringify({ error: `Unknown tool ${name}.` }), isError: true };
  const parsed = spec.schema.safeParse(input ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    console.info(JSON.stringify({ at: "assistant-tool", tool: name, ok: false, issue: `${issue?.path.join(".")}: ${issue?.message}` }));
    ctx.emit({ type: "tool", name, status: "error", label: "Fixing a tool request" });
    return {
      content: JSON.stringify({ error: `Invalid arguments: ${issue?.path.join(".") || "input"} ${issue?.message ?? ""}`.trim() }),
      isError: true,
    };
  }
  const label = spec.label(parsed.data as never);
  ctx.emit({ type: "tool", name, status: "running", label });
  try {
    const result = await spec.run(parsed.data as never, ctx);
    ctx.emit({ type: "tool", name, status: "done", label });
    return { content: JSON.stringify(result) };
  } catch (error) {
    ctx.emit({ type: "tool", name, status: "error", label });
    if ((error as Error).name === "AbortError") throw error;
    const message = error instanceof RoutingError ? error.message : "The tool failed. Try a different request.";
    console.info(JSON.stringify({ at: "assistant-tool", tool: name, ok: false, error: (error as Error).message, input: JSON.stringify(parsed.data).slice(0, 200) }));
    return { content: JSON.stringify({ error: message }), isError: true };
  }
}
