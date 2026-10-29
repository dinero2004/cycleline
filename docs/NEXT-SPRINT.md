# Next sprint (after v3.0.0)

v3.0.0 is the redesign plus Route Studio, the routing API, the AI route assistant and the guest demo; see the README. This list holds what is left from that brief and what we found while building it. Priority 1 comes first.

## Priority 1: before going live on cycleline.mdapex.net

- [ ] **Run the assistant with Claude.**
  - Set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` on the server.
  - Run `npm run eval:assistant`, aiming for at least 15 of 18.
  - Tune `prompts/route-assistant.md` from the failures.
  - Today we only have Llama 3.1 8B results (9/18). Claude has never been run against the app.
- [ ] **Shared state for more than one replica.**
  - Move rate limits, the route cache, guest quotas and assistant conversations from memory to Redis.
  - Until then, run the frontend as a single pod.
- [ ] **Self-host BRouter and Nominatim in the cluster.** The public brouter.de and Nominatim servers only allow light use. Point `BROUTER_URL` and `NOMINATIM_URL` at the new pods.
- [ ] **Map tiles under a proper plan:**
  - OSM's tile servers aren't meant for app traffic.
  - Pick a tile provider (or self-host) with a real dark style.
  - Set `NEXT_PUBLIC_TILES_LIGHT` / `NEXT_PUBLIC_TILES_DARK`. The dark filter on OSM tiles is only a stopgap.
- [ ] **Production env and secrets:**
  - New variables in the Flux manifests: see `frontend/.env.example`.
  - The Laravel migration `050_route_details` must run on deploy.
  - `AI_EVAL_TOKEN` must not be set in production.
- [ ] **Remove or change the seeded demo accounts** (`alexrider`, `admin`) on any public environment.

## Priority 2: brief items not fully met

- [ ] **Demo load time:** largest paint is about 2.75 s on simulated slow 4G; the target is under 2.5 s.
  - The largest element is a map tile that waits on a chain of lazy-loaded scripts (loader → studio → map → Leaflet).
  - Fix: shorten that chain on `/demo` and give the map an early static preview.
  - Measure with Lighthouse on an arm64 Node (it won't run here, because Node is the Intel build).
- [ ] **Garmin / Wahoo / Hammerhead:** today you export a GPX and import it there. Look at their partner APIs for direct sync (all three need an approved developer account).
- [ ] **Real photos on saved route cards:** there are none today. Options: a static map snapshot of the route, or a photo the rider uploads.
- [ ] **Drawing on touch:** pinch-zoom, two-finger pan and press-and-hold work, and markers drag. Still missing: freehand drawing (drag along a road), and moving a waypoint precisely with the keyboard instead of dragging.
- [ ] **Assistant on top of the current route:** pass the drawn route (not just its waypoints) to the assistant, so "make this one flatter" works without planning again.

## Priority 3: quality and polish

- [ ] **Remaining old pages:** dashboard, profile, admin and news only got the new colours. Rebuild them in the new style (hero type, flat cards, condensed metrics).
- [ ] **Route sharing:** links carry only the waypoints and the route is calculated again. Add saved, public share links with a preview image.
- [ ] **GraphHopper loops:** with a key, use GraphHopper's `round_trip` instead of our triangle-shaped loops.
- [ ] **Cost and usage:** log assistant token usage per request and show it in admin.
- [ ] **Accessibility review with a screen reader** (VoiceOver on iOS, TalkBack on Android) of Route Studio and the bottom sheet.
- [ ] **CI:**
  - Run typecheck, lint, Vitest, the build, Playwright and the Laravel tests on every PR.
  - Playwright needs the Laravel API for the sign-up import test; it is skipped without it.
- [ ] **Tidy-ups:**
  - remove the old `RoutePreview` decorative curve
  - `saveRouteAction` is gone, so check the admin views of route data
  - unify the two route-card styles

## Known limits to keep in mind

- **Surface data:** comes from OpenStreetMap tags. Untagged paths show as "unknown", and residential and other roads count as paved by inference (flagged in the UI).
- **Ride time:** a model based on fitness, surface and grade; it doesn't include stops.
- **Guest limits:** 20 routes a day (counted by start and finish), 80 km per route and 8 assistant messages, all set by env variables.
