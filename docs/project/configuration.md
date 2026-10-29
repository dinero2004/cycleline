# Configuration

## Purpose
Where each service reads settings. Names only; no values or secrets here.

## Key files
- `backend/.env.example` → Laravel env template (SQLite default, `DB_CONNECTION=sqlite`)
- `frontend/.env.example` → `AUTH_SECRET`, `BACKEND_URL`
- `compose.yaml` → container env for local prod-like stack
- `render.yaml` → Render env (`APP_KEY` is `sync: false`, i.e. set in dashboard)
- `backend/phpunit.xml` → test env overrides

## How it works
- Frontend: `AUTH_SECRET` signs the Auth.js JWT (`auth.ts:7`); `BACKEND_URL` is the Laravel base URL, server-side only.
- Backend container flags: `RUN_MIGRATIONS`, `SEED_DATABASE`, `PORT` (`backend/docker/entrypoint.sh:4,19,23`).
- Production DB via `DB_CONNECTION=pgsql` + `DB_URL` (Render) or `DB_HOST`/`DB_*` (compose).
- Local `.env` files are git-ignored except `.env.example` (`.gitignore:9-11`).

## Extension points
- New env var: add to the relevant `.env.example`, and to `compose.yaml`/`render.yaml` if containers need it.

## Gotchas
- `config:cache`/`route:cache` run at container start; config changes need restart (`entrypoint.sh:27-28`).
- `compose.yaml` ships development-only secrets; don't reuse them.
