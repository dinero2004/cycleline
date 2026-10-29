# Deployment: VM + Tailscale Funnel

## Purpose
API + Postgres in Docker on an Ubuntu VM behind Tailscale Funnel; the frontend runs on Vercel. Meant for POC, demo and pilot use. Generic deployment options: [../DEPLOYMENT.md](../DEPLOYMENT.md); repo rules: [`AGENTS.md`](../../AGENTS.md).

## Key files
- `compose.vm.yaml` → overrides `compose.yaml` (secrets from `.env.vm`, Postgres bind mount, API on `127.0.0.1:8000`)
- `.env.vm.example` → secret variable names; copy to `.env.vm` (git-ignored)
- `scripts/vm-backup.sh` → nightly `pg_dump` + 14-day prune
- `backend/routes/api.php:16-17` → `throttle:auth` on register/login
- `backend/app/Providers/AppServiceProvider.php` → defines the `auth` rate limiter

## How it works
1. Set the VM to autostart with the host (VMware Workstation: VM > Settings > Options > AutoStart, plus the host must be on and logged in as configured).
2. Install Docker (Compose ≥ 2.24) and Tailscale; add the cron user to the `docker` group.
3. `sudo mkdir -p /srv/cycleline/pgdata /srv/cycleline/backups`
4. Tailnet admin: enable HTTPS + MagicDNS, allow Funnel for the node. Then:
   ```bash
   sudo tailscale up
   sudo tailscale funnel --bg 8000
   ```
5. `cp .env.vm.example .env.vm` and fill in: `APP_KEY` from `php artisan key:generate --show`, `APP_URL` = the Funnel URL, `POSTGRES_PASSWORD`.
6. Start the stack:
   ```bash
   docker compose -f compose.yaml -f compose.vm.yaml --env-file .env.vm up -d --build database backend
   ```
7. Vercel: root directory `frontend/`; env `AUTH_SECRET` (new value) and `BACKEND_URL=https://<vm>.<tailnet>.ts.net/api` (no `NEXT_PUBLIC_`).
8. Before sharing the URL, reset the `admin` and `alexrider` passwords via `POST /api/admin/users/{id}/reset-password` (`backend/routes/api.php:35`), set `SEED_DATABASE=false` in `.env.vm`, and re-run step 6.

## Backups
Cron (no `%` in the line, so no escaping needed):
```
15 2 * * * /path/to/cycleline/scripts/vm-backup.sh >> /var/log/cycleline-backup.log 2>&1
```
Restore into an empty database:
```bash
gunzip -c <file>.sql.gz | docker compose -f compose.yaml -f compose.vm.yaml --env-file .env.vm exec -T database psql -U cycleline cycleline
```
Copying dumps off the VM is manual.

## Extension points
- Invite-only sign-up.
- A custom domain with a reverse proxy instead of Funnel.
- Off-VM backup sync.

## Gotchas
- After a reboot the site is down → `tailscale funnel status`, re-run `tailscale funnel --bg 8000`; verify with `curl https://<vm>.<tailnet>.ts.net/api/health`.
- VM, host or Funnel down → the Vercel app shows errors; Funnel has bandwidth limits, fine for a pilot only.
- Funnel only listens on 443/8443/10000.
- `docker compose down --volumes` does not delete data (bind mount) → delete `/srv/cycleline/pgdata` to reset.
- Riders cannot reset their own password (`MAIL_MAILER=log`, `backend/.env.example:51`) → an admin must.
- Limiter: a known account can be locked out for a minute; a 120/min flood can 429 everyone (availability only).
- `SEED_DATABASE=true` recreates a deleted `admin`/`alexrider` with the public password.
- Pilot users' emails are personal data stored on the operator's VM → tell them.
