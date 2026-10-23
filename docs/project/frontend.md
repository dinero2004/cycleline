# Frontend (Next.js)

## Purpose
Next.js 16 App Router UI, session handling and thin proxies to map services (`frontend/package.json:16-22`).

## Key files
- `frontend/src/app/(app)/` → authenticated pages: dashboard, planner, routes, profile, admin
- `frontend/src/app/news/`, `login/`, `page.tsx` → public pages
- `frontend/src/app/actions.ts` → all Server Actions (profile, bikes, routes, admin, news)
- `frontend/src/app/api/route/route.ts` → BRouter proxy; `api/geocode/route.ts` → Nominatim proxy
- `frontend/src/lib/backend.ts` → `backendFetch`, `BackendError`
- `frontend/src/auth.ts` → Auth.js; types in `src/types/next-auth.d.ts`
- `frontend/src/components/` → planner (`route-planner.tsx`, `planner-map.tsx`), admin console, nav
- `frontend/next.config.ts` → `output: "standalone"`, remote image hosts (unsplash, wikimedia)

## How it works
- Server Actions get the session via `tokenOrRedirect()` (`actions.ts:15`) and return `ActionState` for forms (`:9`).
- Backend validation errors surface as `BackendError.details` (`backend.ts:3-11`, `actions.ts:23`).
- `/api/geocode` requires ≥3 chars and caches 24h (`geocode/route.ts:12,28`); `/api/route` validates points and returns 422/502 on bad input/upstream failure (`route/route.ts:41,68`).
- Round trips append the start point as a third waypoint (`route/route.ts:46-48`).

## Extension points
- New backend call: add a Server Action using `backendFetch`; revalidate affected paths.
- New bike type: update `profiles` in `route/route.ts:16` and `BikeType` in `src/types/index.ts`.

## Gotchas
- `backend.ts` imports `server-only`: never import it from client components.
- `/api/route` and `/api/geocode` handlers have no auth check (`route/route.ts:33`, `geocode/route.ts:9`).
- `BACKEND_URL` defaults to `http://127.0.0.1:8000/api` when unset (`backend.ts:19`, `auth.ts:27`).
