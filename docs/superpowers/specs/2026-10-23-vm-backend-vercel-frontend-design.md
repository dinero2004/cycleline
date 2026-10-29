# Design: Backend in a local VM container, frontend on Vercel

Date: 2026-10-23 · Status: approved in conversation, pending written review

## Goal
Run the CycleLine Laravel API + Postgres in Docker on an Ubuntu Server VM (VMware Workstation) and keep the Next.js frontend on Vercel, usable as a POC/demo/pilot with real, persistent accounts.

## Constraints and facts
- Next.js server actions, Auth.js and route handlers call the API from Vercel's servers using `BACKEND_URL` (`docs/DEPLOYMENT.md:43`; `frontend/src/lib/backend.ts:18-20`, `frontend/src/auth.ts:27`). The API must be reachable from the public internet over HTTPS. The browser never calls the API, so no CORS work is needed.
- No domain is available → Tailscale Funnel supplies a public `https://<vm>.<tailnet>.ts.net` URL.
- Registration is open (`backend/app/Controllers/AuthController.php:11-27`); there is no rate limiting in `backend/app` or `backend/routes`.
- `compose.yaml` contains committed dev secrets: `APP_KEY` (`:25`), DB passwords (`:9,:35`). `APP_ENV=production` forces https URLs (`backend/app/Providers/AppServiceProvider.php:23`).
- The entrypoint seeds on every start when `SEED_DATABASE=true` (`backend/docker/entrypoint.sh:23-25`); seeded demo credentials are public (`README.md:96-101`).

## Architecture
```
Browser → Vercel (Next.js + Auth.js) ──server-side, Bearer──▶ https://<vm>.<tailnet>.ts.net/api
   Tailscale Funnel (TLS, on VM host) → 127.0.0.1:8000 → compose: backend (Apache :8080) → database (Postgres 16)
```

| Unit | Responsibility | Interface | Depends on |
|---|---|---|---|
| `compose.vm.yaml` | VM-specific overrides of `compose.yaml` | `docker compose -f compose.yaml -f compose.vm.yaml --env-file .env.vm up -d --build database backend` | `compose.yaml`, `.env.vm` |
| `.env.vm.example` | Names of required secrets (no values) | copy to `.env.vm` (git-ignored by `.gitignore:10-11`); add `!**/.env.vm.example` to `.gitignore` so the example can be committed | — |
| Tailscale Funnel (host) | Public HTTPS front for `127.0.0.1:8000` | `tailscale funnel --bg 8000` | tailscaled, tailnet settings |
| Backup cron (host) | Nightly Postgres dump | `pg_dump` via `docker compose exec` → `/srv/cycleline/backups` | running `database` |
| Throttle middleware | Limit brute-force/sign-up abuse | Named limiter `auth` (`RateLimiter::for` in `AppServiceProvider::boot`) applied as `throttle:auth` to `POST /auth/register` and `POST /auth/login` in `backend/routes/api.php`. Keys: per submitted `login`/`email` (lower-cased) at 10/min, plus one global bucket at 120/min. | Laravel cache (file driver, single container) |
| Vercel project | Hosts `frontend/` | env `AUTH_SECRET`, `BACKEND_URL` | public API URL |

## `compose.vm.yaml`
- `database`: bind mount `/srv/cycleline/pgdata:/var/lib/postgresql/data` (replaces the named volume; the declared `cycleline-postgres` volume stays unused); the postgres image entrypoint chowns the directory on first init when started as root; `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?}`; `restart: unless-stopped`.
- `backend`: `APP_KEY: ${APP_KEY:?}`, `DB_PASSWORD: ${POSTGRES_PASSWORD:?}`, `APP_URL: ${APP_URL:?}`, `SEED_DATABASE: ${SEED_DATABASE:-false}`; `RUN_MIGRATIONS=true` is inherited from `compose.yaml:39` (migrations run on every start); ports via `!override` → `127.0.0.1:8000:8080` (needs Docker Compose ≥ 2.24); `restart: unless-stopped`.
- `frontend` is not started (named services only).
- Secrets live only in `.env.vm`; never committed.

## Seeding and accounts
- Seeder behavior (`backend/database/seeders/DatabaseSeeder.php`): users use `firstOrCreate` (existing passwords are never reset); the demo route and news use `updateOrCreate` (edited seeded content is restored on a seeded start). A deleted `admin`/`alexrider` is recreated with the public password.
- First start: `SEED_DATABASE=true` for demo content. The public demo credentials are live on the public URL until step 5 of the setup sequence, so do steps 3–5 back to back, before sharing the Vercel URL.
- Change `admin` and `alexrider` passwords via `POST /api/admin/users/{id}/reset-password` (`backend/routes/api.php:35`), then set `SEED_DATABASE=false` and recreate the backend.
- Sign-up stays open, protected by the `auth` limiter. On 429 the frontend shows its existing generic failure (Auth.js `authorize` returns null on any non-OK, `frontend/src/auth.ts:41-43`; actions surface `BackendError`, `frontend/src/app/actions.ts:23-28`); no frontend change.
- Why not plain per-IP `throttle`: all calls come server-side from Vercel egress IPs and Laravel has no trusted-proxy config (`backend/bootstrap/app.php`), so per-IP keys would collapse into one shared bucket. Trade-offs of the keyed limiter, accepted for a pilot: the per-key limit stops guessing against one account but lets an attacker lock out a known account (e.g. `admin`) for a minute; the global bucket caps rotating-key floods but a sustained flood of 120/min can 429 legitimate logins/sign-ups. Both are availability risks, not credential exposure; tune limits or add edge filtering later.

## Backups and persistence
- Data persists in `/srv/cycleline/pgdata` across reboots, restarts and rebuilds; `docker compose down --volumes` no longer deletes it (bind mount), `rm -rf` of that directory does.
- Nightly backup is a bash script `scripts/vm-backup.sh` (`#!/usr/bin/env bash`, `set -o pipefail`, dumps to a temp name and renames only on success), run from cron with the repo dir as cwd; `%` is escaped in crontab. The dump command:
  `docker compose -f compose.yaml -f compose.vm.yaml --env-file .env.vm exec -T database pg_dump -U cycleline cycleline | gzip > /srv/cycleline/backups/$(date +%F).sql.gz`
  Prune: `find /srv/cycleline/backups -name '*.sql.gz' -mtime +14 -delete`.
- Restore into an empty database: `gunzip -c <file>.sql.gz | docker compose -f compose.yaml -f compose.vm.yaml --env-file .env.vm exec -T database psql -U cycleline cycleline`; steps also in `docs/project/deployment-vm.md`. Copying dumps off the VM is manual.
- After a VM reboot, verify `tailscale funnel status` still shows the funnel and `/api/health` answers.

## Setup sequence
1. VM: install Docker (Compose ≥ 2.24), Tailscale; create `/srv/cycleline/{pgdata,backups}`; set VM to autostart with the host.
2. Tailnet admin: enable HTTPS + MagicDNS; allow Funnel for the node. Run `tailscale up`, `tailscale funnel --bg 8000`.
3. Create `.env.vm` (`APP_KEY` from `php artisan key:generate --show`, `POSTGRES_PASSWORD`, `APP_URL`, `SEED_DATABASE=true`); start the stack.
4. Vercel: root `frontend/`; `AUTH_SECRET` (new random), `BACKEND_URL=https://<vm>.<tailnet>.ts.net/api` (no `NEXT_PUBLIC_`); deploy.
5. Reset demo passwords; set `SEED_DATABASE=false`; recreate backend.

## Verification
- `curl localhost:8000/api/health` on the VM, then `curl https://<vm>.<tailnet>.ts.net/api/health` from outside → `{"status":"ok","service":"cycleline-api"}`.
- Register in the Vercel app, `docker compose restart`, confirm the account survives and logs in.
- Pest test: repeated bad logins/registrations return 429 after the limit.
- Backup: run the dump, restore into a scratch database, confirm users exist.

## Failure modes
- Tailscale/Funnel or VM down → Vercel app loads, login/data calls fail.
- Funnel bandwidth limits under heavy use (acceptable for a pilot).
- Riders have no self-service password reset (`MAIL_MAILER=log`, `backend/.env.example:51`); admin resets only.
- Pilot users' emails are personal data held on the operator's VM; tell pilot users.

## Deliverables
`compose.vm.yaml`, `.env.vm.example` (+ `.gitignore` negation), `scripts/vm-backup.sh`, `docs/project/deployment-vm.md` (setup sequence, backup/restore, reboot check), throttle limiter + route changes + Pest test.

## Out of scope
Monitoring, rate limiting beyond login/register, invite-only sign-up, off-VM backup automation, email delivery, CI.
