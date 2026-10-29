# AGENTS.md

## What this is
CycleLine: a cycling route planner. `frontend/` (Next.js 16 / React 19 / Auth.js) talks to `backend/` (Laravel 12 JSON API + Sanctum); routing and geocoding come from BRouter and Nominatim.

## Layout
| Dir | Responsibility |
|---|---|
| `backend/app/Controllers/` | API controllers (Auth, User, Bike, Routes, News, Admin) — **not** `app/Http/Controllers` |
| `backend/app/Models/` | Eloquent models: User, Route, Bike, News |
| `backend/app/Http/Middleware/EnsureAdmin.php` | `admin` middleware alias (`backend/bootstrap/app.php:14`) |
| `backend/routes/api.php` | All endpoints (public, `auth:sanctum`, `admin` groups) |
| `backend/database/` | Numbered migrations (`000_`–`040_`), `DatabaseSeeder.php` |
| `backend/tests/Feature/` | Pest tests (`AdminTest.php`, `AuthAndRoutesTest.php`) |
| `frontend/src/app/` | App Router pages, `actions.ts` (Server Actions), `api/` proxies |
| `frontend/src/components/` | UI + planner components |
| `frontend/src/lib/backend.ts`, `src/auth.ts` | Server-only API client; Auth.js config |
| `docs/` | Existing `API.md`, `ARCHITECTURE.md`, `DEPLOYMENT.md`; agent docs in `docs/project/` |

## Commands (verified by running on 2026-10-23 unless noted)
| Task | Command | Defined in |
|---|---|---|
| API install / serve | `composer install` (verified), `php artisan serve` (not run) | `README.md:50-58` |
| Migrate + seed | `php artisan migrate:fresh --seed` (not run) | `README.md:56` |
| API format check | `vendor/bin/pint --test` (verified) | `README.md:129` |
| API tests | `php artisan test --testsuite=Feature` (5 pass, PHP 8.5 deprecations) | `.agents/gates.md` |
| Web dev (not run) / build (verified) | `npm run dev` / `npm run build` (in `frontend/`) | `frontend/package.json:9-10` |
| Web lint / types | `npm run lint` / `npm run typecheck` (verified) | `frontend/package.json:12-13` |
| Full stack (not run, no docker) | `docker compose up --build` | `compose.yaml`, `README.md:91` |
Gates: `.agents/gates.md`. Work loop: `.agents/commands/process.md`.

## Conventions
- Controllers are plain classes (no base class) in `App\Controllers`; validate inline with `$request->validate()`, return `response()->json(...)` (`NewsController.php:97`).
- Route/bike access is owner-scoped: `authorizeOwner()` does `abort_unless(user_id === auth id, 404)` (`RoutesController.php:149`, `BikeController.php:81`).
- Admin endpoints live only inside the `admin` prefix group in `backend/routes/api.php:30`.
- Frontend never calls Laravel from the browser: use Server Actions (`frontend/src/app/actions.ts`) with `backendFetch` and `session.accessToken`; `lib/backend.ts` is `server-only`.
- Actions that mutate data call `revalidatePath` for affected pages (`actions.ts:61`).
- Imports use the `@/*` alias → `frontend/src/*` (`frontend/tsconfig.json:25`).
- `BACKEND_URL` is server-only; never prefix with `NEXT_PUBLIC_` (`docs/DEPLOYMENT.md:43`).

## Gotchas
- Migrations are named `000_`…`040_`, not timestamps; keep numeric order so FKs resolve (`backend/database/migrations/`).
- `app/Http/Controllers/Controller.php` is an unused stub; new controllers go in `app/Controllers/`.
- `backend/docker/entrypoint.sh:19-28` migrates/seeds from `RUN_MIGRATIONS`/`SEED_DATABASE`, then runs `config:cache` + `route:cache`: env changes need a rebuild/restart.
- Seeder holds demo credentials (`DatabaseSeeder.php`); `render.yaml:44` keeps `SEED_DATABASE=false`. Never enable in production.
- `compose.yaml` contains dev-only secrets; never reuse in real environments.
- BRouter/Nominatim are public endpoints hard-coded in `frontend/src/app/api/{route,geocode}/route.ts`.
- CI: `.github/workflows/ci.yml` runs the backend and frontend gates plus both Docker builds on every PR and push to `main`.

## Git/PR rules
- No branch-name or PR-title rule found in the repo. Commits in history use Conventional Commit prefixes (`feat:`, `fix:`, `chore:`) and PR-number suffix (`(#1)`).
- Unrelated bugs found along the way: file as issues (`.agents/commands/issue.md`); don't widen scope.

## Working with subagents
Main session orchestrates; roles are in `.agents/roles/`: `scout`, `researcher` (understand code first), `coder` (implement), `reviewer` (review diff before PR/merge), `issue-filer` (bugs found along the way).
- GitHub Copilot: native custom agents at `.github/agents/<role>.agent.md`; each only points to its role file.
- Tools without subagents: read the role file and follow it inline.

## Agent commands
`.agents/commands/` (issue filing, `process.md` work loop). Gates: `.agents/gates.md`. Copilot prompts: `.github/prompts/`.

## Docs
`docs/project/README.md`
