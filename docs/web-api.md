# CycleLine web API (Next.js route handlers)

These endpoints live in `frontend/src/app/api/`. They sit in front of the routing providers, the place search, the elevation and forecast services and the AI model, so no API key ever reaches the browser. The Laravel API (accounts, saved routes, news, admin) is in [API.md](API.md).

## Basics

- **Requests and responses:** JSON, except the GPX export (a file) and the assistant (server-sent events).
- **Validation:** every input is checked with a zod schema (`src/lib/routing/schema.ts`).
- **Errors:** always come back in one shape:

```json
{ "error": { "code": "no_route", "message": "No cycling path found between these points." } }
```

| code | HTTP | meaning |
|---|---|---|
| `invalid_request` | 422 | Input failed validation (the message names the field) |
| `too_long` | 422 | Over the route-length cap (300 km, guests 80 km) |
| `no_route` | 404 | No path or place found |
| `rate_limited` | 429 | Rate limit or daily quota reached; `Retry-After` header set where it applies |
| `provider_unavailable` / `timeout` | 502 | Upstream service down or slow, even after retry and fallback |
| `internal` | 500 | Unexpected error |

**Identity:** a signed-in user is identified by the Auth.js session. A guest is identified by a signed `cl_guest` cookie, or by IP when there is no cookie. Guests get lower limits (`src/lib/guest.ts`).

## Types

The `Route` type is in `src/lib/routing/types.ts`. Positions are GeoJSON order `[lng, lat, ele]`; waypoints are `[lat, lng]`.

```ts
interface Route {
  id: string;                     // stable hash of provider, profile, waypoints, variant
  provider: "brouter" | "graphhopper" | "valhalla" | "manual";
  profile: "road" | "gravel" | "mtb" | "ebike" | "commuter";
  waypoints: [lat, lng][];
  geometry: { type: "LineString"; coordinates: [lng, lat, ele][] };
  distanceM: number; ascentM: number; descentM: number;
  providerDurationS: number | null;   // the provider's own estimate; the UI uses estimateDurationS(route, fitness)
  maxGradePct: number;                // steepest 100 m window
  avgGradePct: number;                // average of the uphill windows
  elevation: { d: number; e: number }[];   // ≤ 240 samples from the full-resolution line
  segments: {
    startM: number; endM: number;
    surface: "paved" | "gravel" | "trail" | "unknown";
    surfaceInferred: boolean;         // true = taken from the road class, not a surface tag
    surfaceTag?: string; highway?: string;
    gradePct: number; cycleway: boolean;
  }[];
  surfaceMix: { paved: number; gravel: number; trail: number; unknown: number };  // metres
  inferredSurfaceM: number;
  warnings: { kind: "steep" | "unpaved" | "busy_road"; message: string; startM: number; endM: number }[];
}

interface RankedRoute extends Route { score: number; why: string }   // score 0–100, why = one plain sentence

interface RoutePreferences {
  maxGradePct?: number;              // 2–30
  avoidHighways?: boolean;
  preferCycleways?: boolean;
  surface?: "paved" | "mixed" | "gravel";
  minimizeTraffic?: boolean;
  scenic?: number;                   // 0–1; only lowers the weight of ride time when ranking
}
```

## Endpoints

### `POST /api/route`

One route through the waypoints.

```json
{ "waypoints": [[47.3667, 8.545], [47.2965, 8.6733]], "profile": "gravel",
  "preferences": { "minimizeTraffic": true }, "fitness": "intermediate" }
```

- **Response:** `{ "route": Route }`.
- **Limits:** 2–25 waypoints.
- **Old format:** the original planner's body `{ start, end, profile: BikeType, routeType }` is still accepted.

### `POST /api/route/alternatives`

- **Request:** the same body as `/api/route`.
- **Response:** `{ "routes": RankedRoute[] }`, up to 3, best first.
- **How candidates are made:** the provider's alternatives plus a variant with the opposite `minimizeTraffic` setting. Near-duplicates are dropped and the rest are scored against the preferences (`src/lib/routing/scoring.ts`).

### `POST /api/route/loop`

```json
{ "start": [47.37, 8.54], "distanceKm": 40, "bearing": 90, "profile": "gravel", "preferences": {}, "fitness": "strong" }
```

- **Response:** `{ "routes": RankedRoute[] }` (round trips).
- **Fields:** `bearing` is optional. Without it, three directions are tried.
- **Filtering:** loops more than 35% off the target are dropped when closer ones exist.

### `POST /api/elevation`

```json
{ "coordinates": [[47.3667, 8.545], [47.35, 8.49]] }
```

- **Response:** `{ "profile": [{ "d": 0, "e": 408 }, …], "coordinates": [[lng, lat, ele], …], "ascentM": 443, "descentM": 0 }`.
- **Sampling:** the line is resampled every ~50 m (at most 200 points). Heights come from Open-Meteo (Copernicus DEM). Route Studio uses this when "snap to road" is off.

### `GET /api/geocode?q=…&limit=5`

- **Response:** `{ "results": [{ "name", "label", "coordinates": [lat, lng], "type" }], "name", "coordinates" }`.
- **Old format:** the top-level `name` and `coordinates` are the first match, kept for older callers.
- **Limits:** `limit` is 1–8. Data comes from Nominatim and is cached for 24 h.

### `POST /api/export/gpx`

```json
{ "name": "Lake loop", "coordinates": [[8.5, 47.3, 400], …], "waypoints": [{ "point": [47.3, 8.5], "name": "Start" }] }
```

- **Response:** a GPX 1.1 download (`Content-Disposition: attachment`) with metadata, waypoints, and a track that has elevation.
- **Guest exports:** carry a short note in `<desc>`.

### `POST /api/assistant` (server-sent events)

```json
{ "message": "60 km gravel loop from Munich, under 800 m of climbing",
  "conversationId": "…optional, from the start event…",
  "context": { "waypoints": [{ "label": "Zürich HB", "point": [47.378, 8.54] }], "profile": "gravel", "fitness": "intermediate" },
  "pow": { "challenge": "…", "nonce": "…" } }
```

**Events:** each is a `data:` line holding one JSON object.

| `type` | payload |
|---|---|
| `start` | `conversationId`, `provider` |
| `text` | `delta`: streamed answer text. Coordinates that no tool returned are replaced, and route/place ids are shown as "option N" or the place name. |
| `tool` | `name`, `status` (`running` / `done` / `error`), `label` |
| `routes` | `routes: { rank, title, why, route: RankedRoute }[]`: the cards; picking one draws it on the map |
| `signup` | `reason`: a guest tried to save, so the app shows the free account offer |
| `error` | `code`, `message` |
| `done` | `usage.toolCalls` |

**Rules:**
- Closing the request cancels the answer.
- `pow` is only needed for a guest's first message in a conversation. The challenge comes from `GET /api/assistant/challenge`.

### `GET /api/assistant/challenge`

- **Response:** `{ "challenge", "difficulty" }`.
- **What to do with it:** find a numeric `nonce` such that `sha256(challenge + nonce)` starts with `difficulty` zero bits. The default difficulty is 14 bits, which takes well under a second.

## Limits

All limits can be changed with environment variables:

| What | Default | Variable |
|---|---|---|
| Routing requests per minute (per IP, and per session) | 30 | `RATE_LIMIT_ROUTING_PER_MIN` |
| Place searches per minute | 60 | `RATE_LIMIT_GEOCODE_PER_MIN` |
| Route length cap | 300 km | `MAX_ROUTE_KM` |
| Guest: routes per day / length / AI messages per day | 20 / 80 km / 8 | `GUEST_ROUTES_PER_DAY`, `GUEST_MAX_ROUTE_KM`, `GUEST_AI_MESSAGES_PER_DAY` |
| Members: AI messages per day | 60 | `MEMBER_AI_MESSAGES_PER_DAY` |
| AI messages per minute per IP | 6 | `AI_MESSAGES_PER_MIN` |
| AI: model steps / tool calls per answer / output tokens | 6 / 8 / 8000 (Claude), 2000 (OpenAI-compatible) | `AI_MAX_STEPS`, `AI_MAX_TOOL_CALLS`, `AI_MAX_OUTPUT_TOKENS` |

Rate limits and caches are kept in memory per server process. Behind more than one replica, move them to Redis (see [routing-adr.md](routing-adr.md)).
