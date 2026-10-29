# Architecture

## Purpose
Two independently deployed services: a Next.js server that owns the UI and session, and a Laravel JSON API that owns data and authorization. Diagrams and ownership guarantees: [../ARCHITECTURE.md](../ARCHITECTURE.md).

## Key files
- `frontend/src/auth.ts` → Auth.js config, calls Laravel login
- `frontend/src/lib/backend.ts` → only HTTP client to Laravel (`server-only`)
- `backend/bootstrap/app.php` → API-only routing (`routes/api.php`), `admin` alias
- `compose.yaml`, `render.yaml` → how services are wired/deployed

## How it works
- Browser never holds the Laravel token; it lives in the Auth.js JWT (30-day `maxAge`, `auth.ts:13`).
- `(app)` route group is guarded by `auth()` and redirects to `/login` (`frontend/src/app/(app)/layout.tsx:5-10`).
- Authorization is enforced in Laravel, not Next: `auth:sanctum` + `admin` group (`backend/routes/api.php:21,30`).
- External map calls are separated from persistence: `/api/geocode` and `/api/route` only compute; saving is a Server Action.
- BRouter profile mapping by bike type: `frontend/src/app/api/route/route.ts:16-23`.
- Container topology: `database` (postgres:16) → `backend` (Apache :8080→8000) → `frontend` (:3000) (`compose.yaml`).

## Extension points
- New API resource: route in `backend/routes/api.php`, controller in `backend/app/Controllers/`, migration after `040_`.
- New UI mutation: Server Action in `frontend/src/app/actions.ts` + `revalidatePath`.

## Gotchas
- `render.yaml` only builds/deploys the backend; the frontend targets Vercel (`docs/DEPLOYMENT.md:34-43`).
- `AppServiceProvider.php:23` forces HTTPS URLs in production.
