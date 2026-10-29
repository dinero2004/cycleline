# ADR: Routing provider and fallback

- **Status:** accepted, 2026-10-29
- **Context:** CycleLine needs rideable, surface-aware bicycle routes with elevation, served from our own endpoints with no API keys in the browser. The web app and API run on one Linux server (Kubernetes). Traffic is small today. The budget for paid APIs is zero unless there's a reason.

## Decision

The **primary provider is BRouter**. It's already in use, through the public `brouter.de` server, and can move to a self-hosted instance with the `BROUTER_URL` setting. The fallback chain is set with `ROUTING_PROVIDERS`. The default chain is `brouter,graphhopper,valhalla`:

1. **BRouter**
   - No key.
   - Cycling-specific profiles: `fastbike`, `fastbike-lowtraffic`, `fastbike-verylowtraffic`, `gravel`, `mtb`, `trekking`, `safety`.
   - Returns elevation for every point.
   - Returns the OSM way tags (`surface`, `tracktype`, `highway`, `cycleway…`) for every stretch of road, which drives the surface mix, the busy-road warnings and the grades without a second request.
   - Gives up to 3 alternatives through `alternativeidx`.
2. **GraphHopper**
   - Needs `GRAPHHOPPER_API_KEY`, so it's skipped until a key is set.
   - Has `surface` and `road_class` details, elevation and alternative routes.
   - The free plan only has the `bike` profile. `GRAPHHOPPER_ROAD_PROFILE` and `GRAPHHOPPER_MTB_PROFILE` switch on `racingbike` and `mtb` on paid plans.
3. **Valhalla**
   - Uses the public FOSSGIS server by default, and can be self-hosted with the `VALHALLA_URL` setting.
   - Its bicycle costing options (`bicycle_type`, `use_roads`, `use_hills`, `avoid_bad_surfaces`) map onto our preferences.
   - Surface and road class come from a `trace_attributes` call. Valhalla has no elevation, so heights come from Open-Meteo.
4. **Mapbox or Google:** not implemented.
   - Both cost money for the cycling directions and surface data we need, and their terms limit storing and re-exporting geometry, which GPX export does.
   - The `RoutingProvider` interface (`lib/routing/providers/types.ts`) is the place to add one if that changes.

**Why BRouter first:**
- It costs nothing and needs no key.
- Its profiles are tuned for road and gravel riding, which other engines approximate with weightings.
- It's the only option that gives elevation and tags in the same response.
- It already works in production, and it's a single Java process we could run in the cluster later.

**Downside:** the public brouter.de server is a shared community service with no SLA. That's why the fallback chain exists and why we cache.

**Elevation for arbitrary lines** (`POST /api/elevation`, used for hand-drawn lines and Valhalla routes) comes from **Open-Meteo**: Copernicus 90 m DEM, free, no key, 100 points per request.

**Map tiles:**
- The map stays on **Leaflet** with raster tiles. The existing component was already good, and switching to MapLibre GL would add about 200 kB of JavaScript for no feature we need.
- Light theme uses OpenStreetMap standard tiles. Dark theme uses CARTO's free `dark_all` basemap.
- Both are configurable with `NEXT_PUBLIC_TILES_LIGHT` and `NEXT_PUBLIC_TILES_DARK`.

## How the fallback behaves

- Each call has a timeout of 12 s and one retry with exponential backoff, but only for `provider_unavailable` and `timeout` errors.
- **No path found** is an answer, not an outage, so the next provider isn't asked. Different engines rarely disagree here, and asking them all would only slow the error down.
- Results are cached in memory for 1 h, keyed by a hash of the waypoints, profile, preferences and alternative index.
- Rate limits:
  - 30 routing requests per minute per IP, and again per session or guest id.
  - Guests get 20 routes a day and 80 km per route.
  - All of these are set by env variables.
- **Limitation:** the in-memory cache and rate limits are per process. With more than one replica, move both to Redis.
- **Logging:** one JSON line per provider call with the provider, ok, ms, attempt and error code. Request URLs are never logged, because GraphHopper's key travels in the query string.

## Consequences

- Route quality depends on OSM tagging. Untagged paths go into an honest **unknown** surface bucket. Road classes that are almost always paved (residential, tertiary…) are counted as paved but flagged `surfaceInferred`, and the UI shows how many km were inferred.
- Loops are built from a triangle of via points: three bearings, sized for the target distance divided by 1.25, then scored on how close each lands to the target. BRouter has no native round-trip mode. GraphHopper's `round_trip` could replace this once a key is configured.
- Usage policies:
  - brouter.de, Nominatim and the FOSSGIS Valhalla server ask for light use and an identifying User-Agent, which we send.
  - Real traffic needs self-hosted BRouter and Nominatim. Both run fine as pods next to the app.
