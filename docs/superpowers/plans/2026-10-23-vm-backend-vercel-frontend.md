# VM Backend + Vercel Frontend Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the CycleLine API + Postgres in Docker on an Ubuntu VM, exposed via Tailscale Funnel, with the frontend on Vercel, persistent accounts, backups and login/register throttling.

**Architecture:** A `compose.vm.yaml` override of `compose.yaml` (secrets from `.env.vm`, Postgres bind mount, API bound to `127.0.0.1:8000`) fronted by host-level Tailscale Funnel. One backend change adds a keyed rate limiter to `POST /auth/register` and `POST /auth/login`. A bash script plus cron handles nightly `pg_dump`.

**Tech Stack:** Laravel 12 / Pest (PHP), Docker Compose ≥ 2.24, Postgres 16, Tailscale Funnel, bash, Vercel.

Spec: `docs/superpowers/specs/2026-10-23-vm-backend-vercel-frontend-design.md`. Repo conventions and gate commands: `AGENTS.md`, `.agents/gates.md`.

## File Structure
| File | Responsibility |
|---|---|
| `backend/app/Providers/AppServiceProvider.php` (modify) | Defines the `auth` rate limiter |
| `backend/routes/api.php` (modify) | Applies `throttle:auth` to register/login |
| `backend/tests/Feature/AuthThrottleTest.php` (create) | Tests the limiter |
| `compose.vm.yaml` (create) | VM overrides of `compose.yaml` |
| `.env.vm.example` (create) / `.gitignore` (modify) | Secret variable names, committable |
| `scripts/vm-backup.sh` (create) | Nightly dump + prune |
| `docs/project/deployment-vm.md` (create) / `docs/project/README.md` (modify) | Operator runbook, linked from the index |

Local note: Docker is not installed on the dev machine; compose and Funnel steps are verified on the VM (Task 5). Backend gate: `php artisan test --testsuite=Feature` (plain `php artisan test` fails at baseline, see `.agents/gates.md`).

---

## Chunk 1: Implementation

### Task 1: Keyed rate limiter on login/register

**Files:**
- Create: `backend/tests/Feature/AuthThrottleTest.php`
- Modify: `backend/app/Providers/AppServiceProvider.php`
- Modify: `backend/routes/api.php:16-17`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/Feature/AuthThrottleTest.php`:

```php
<?php

it('throttles repeated login attempts for the same account', function () {
    foreach (range(1, 10) as $attempt) {
        $this->postJson('/api/auth/login', ['login' => 'Admin', 'password' => 'wrong'])
            ->assertStatus(422);
    }

    $this->postJson('/api/auth/login', ['login' => 'admin', 'password' => 'wrong'])
        ->assertStatus(429);
});

it('does not throttle other accounts when one account is locked', function () {
    foreach (range(1, 11) as $attempt) {
        $this->postJson('/api/auth/login', ['login' => 'victim', 'password' => 'wrong']);
    }

    $this->postJson('/api/auth/login', ['login' => 'someone-else', 'password' => 'wrong'])
        ->assertStatus(422);
});

it('caps total auth requests with a global bucket', function () {
    foreach (range(1, 120) as $attempt) {
        $this->postJson('/api/auth/login', ['login' => "user{$attempt}", 'password' => 'wrong']);
    }

    $this->postJson('/api/auth/login', ['login' => 'user-final', 'password' => 'wrong'])
        ->assertStatus(429);
});

it('throttles registration by email', function () {
    foreach (range(1, 10) as $attempt) {
        $this->postJson('/api/auth/register', ['email' => 'spam@cycleline.test'])
            ->assertStatus(422);
    }

    $this->postJson('/api/auth/register', ['email' => 'spam@cycleline.test'])
        ->assertStatus(429);
});
```

Note: failed login and invalid registration both return 422 (`AuthController`). The global-bucket test sends 120 hashed-password checks and may take a few seconds.

- [ ] **Step 2: Run tests to verify they fail**

Run (in `backend/`): `php artisan test --testsuite=Feature --filter=AuthThrottleTest`
Expected: tests 1, 3 and 4 FAIL on the `429` assertions. Test 2 passes already (no throttling yet); that is fine.

- [ ] **Step 3: Define the limiter**

Edit `backend/app/Providers/AppServiceProvider.php` to:

```php
<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }

        // Calls arrive from Vercel's servers, so per-IP keys would share one bucket.
        RateLimiter::for('auth', function (Request $request) {
            $identity = $request->input('login', $request->input('email', ''));
            $identity = is_string($identity) ? Str::lower($identity) : '';

            return [
                Limit::perMinute(10)->by('identity:'.$identity),
                Limit::perMinute(120)->by('auth-global'),
            ];
        });
    }
}
```

- [ ] **Step 4: Apply the limiter to the routes**

Edit `backend/routes/api.php` lines 16-17 to:

```php
Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:auth');
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:auth');
```

- [ ] **Step 5: Run tests to verify they pass**

Run (in `backend/`): `php artisan test --testsuite=Feature`
Expected: all Feature tests pass (5 existing + 4 new; PHP 8.5 `DEPR` markers are the known baseline). If an existing test now returns 429, the array cache is leaking across tests: confirm `CACHE_STORE=array` at `backend/phpunit.xml:24` and that the existing tests don't exceed the limits.

- [ ] **Step 6: Format and commit**

Run (in `backend/`): `vendor/bin/pint --test`
Expected: PASS (if it reports style fixes, run `vendor/bin/pint` and re-check).

```bash
git add backend/app/Providers/AppServiceProvider.php backend/routes/api.php backend/tests/Feature/AuthThrottleTest.php
git commit -m "feat: throttle login and register by submitted identity"
```

### Task 2: VM compose override and secrets template

**Files:**
- Create: `compose.vm.yaml`
- Create: `.env.vm.example`
- Modify: `.gitignore:11`

- [ ] **Step 1: Create `compose.vm.yaml`**

```yaml
# VM overrides. Run with:
#   docker compose -f compose.yaml -f compose.vm.yaml --env-file .env.vm up -d --build database backend
# Naming the services keeps `frontend` from starting (Vercel hosts it).
services:
  database:
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env.vm}
    volumes: !override
      - /srv/cycleline/pgdata:/var/lib/postgresql/data

  backend:
    restart: unless-stopped
    environment:
      APP_KEY: ${APP_KEY:?set APP_KEY in .env.vm}
      APP_URL: ${APP_URL:?set APP_URL in .env.vm}
      DB_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env.vm}
      SEED_DATABASE: ${SEED_DATABASE:-false}
    ports: !override
      - "127.0.0.1:8000:8080"
```

- [ ] **Step 2: Create `.env.vm.example`** (names only, no real values)

```env
# Copy to .env.vm on the VM and fill in. Never commit .env.vm.
# From: php artisan key:generate --show   (full base64:... value)
APP_KEY=
# Public Funnel URL, e.g. https://<vm>.<tailnet>.ts.net
APP_URL=
POSTGRES_PASSWORD=
# true only for the first start (demo data), then false
SEED_DATABASE=true
```

- [ ] **Step 3: Allow the example file in git**

Edit `.gitignore`: add a new line directly after `!**/.env.example` (line 11):

```
!**/.env.vm.example
```

- [ ] **Step 4: Verify ignore rules**

Run: `git check-ignore -v .env.vm .env.vm.example; echo "exit=$?"`
Expected: `.env.vm` reported as ignored (rule `**/.env.*`); `.env.vm.example` is matched by the `!` negation or not listed.

Run: `git add -n .env.vm.example compose.vm.yaml .gitignore`
Expected: all three listed as would-be-added.

- [ ] **Step 5: Validation deferred**

No local check is meaningful (Docker is not installed here). `docker compose ... config` on the VM in Task 5 Step 1 is the real validation.

- [ ] **Step 6: Commit**

```bash
git add compose.vm.yaml .env.vm.example .gitignore
git commit -m "chore: add VM compose override and secrets template"
```

### Task 3: Backup script

**Files:**
- Create: `scripts/vm-backup.sh`

- [ ] **Step 1: Create the script**

```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

backup_dir="${BACKUP_DIR:-/srv/cycleline/backups}"
mkdir -p "$backup_dir"

tmp="$backup_dir/.dump-$$.tmp"
final="$backup_dir/$(date +%F).sql.gz"
trap 'rm -f "$tmp"' EXIT

docker compose -f compose.yaml -f compose.vm.yaml --env-file .env.vm \
  exec -T database pg_dump -U cycleline cycleline | gzip > "$tmp"

mv "$tmp" "$final"
find "$backup_dir" -name '*.sql.gz' -mtime +14 -delete
```

- [ ] **Step 2: Make it executable and syntax-check**

Run: `chmod +x scripts/vm-backup.sh && bash -n scripts/vm-backup.sh && echo ok`
Expected: `ok`

- [ ] **Step 3: Verify failure behavior without Docker (local)**

Run: `d=./.tmp-backup-test; BACKUP_DIR=$d ./scripts/vm-backup.sh; echo "exit=$?"; ls -A $d; rm -rf $d`
Expected: non-zero exit (docker missing) and an empty directory listing: no `.sql.gz` or temp file left (`pipefail` + `trap`).

- [ ] **Step 4: Commit**

```bash
git add scripts/vm-backup.sh
git commit -m "chore: add nightly Postgres backup script"
```

### Task 4: Operator runbook

**Files:**
- Create: `docs/project/deployment-vm.md`
- Modify: `docs/project/README.md` (files table)

- [ ] **Step 1: Create `docs/project/deployment-vm.md`** (≤150 lines; sections Purpose / Key files / How it works / Extension points / Gotchas per `AGENTS.md` docs rules)

Write the file with exactly this skeleton (fill each bullet with the commands shown; link to `AGENTS.md` and `docs/DEPLOYMENT.md` rather than repeating them):

- `# Deployment: VM + Tailscale Funnel`
- `## Purpose`: API + Postgres in Docker on an Ubuntu VM behind Tailscale Funnel; frontend on Vercel; for POC/demo/pilot.
- `## Key files`: `compose.vm.yaml`, `.env.vm.example`, `scripts/vm-backup.sh`, `backend/routes/api.php:16-17`, `backend/app/Providers/AppServiceProvider.php`.
- `## How it works`, numbered setup:
  1. Set the VM to autostart with the host (VMware Workstation: VM > Settings > Options > AutoStart, plus the host must be on and logged in as configured).
  2. Install Docker (Compose ≥ 2.24) and Tailscale; add the cron user to the `docker` group.
  3. `sudo mkdir -p /srv/cycleline/pgdata /srv/cycleline/backups`.
  4. Tailnet admin: enable HTTPS + MagicDNS, allow Funnel for the node. Then `sudo tailscale up` and `sudo tailscale funnel --bg 8000`.
  5. `cp .env.vm.example .env.vm`, fill values (`APP_KEY` from `php artisan key:generate --show`, `APP_URL` = Funnel URL, `POSTGRES_PASSWORD`).
  6. `docker compose -f compose.yaml -f compose.vm.yaml --env-file .env.vm up -d --build database backend`.
  7. Vercel: root directory `frontend/`; env `AUTH_SECRET` (new), `BACKEND_URL=https://<vm>.<tailnet>.ts.net/api` (no `NEXT_PUBLIC_`).
  8. Before sharing the URL, reset `admin` and `alexrider` passwords via `POST /api/admin/users/{id}/reset-password`, set `SEED_DATABASE=false`, re-run step 6.
- `## Backups`: cron `15 2 * * * /path/to/cycleline/scripts/vm-backup.sh >> /var/log/cycleline-backup.log 2>&1` (no `%` in the line, so no escaping needed). Restore into an empty database: `gunzip -c <file>.sql.gz | docker compose -f compose.yaml -f compose.vm.yaml --env-file .env.vm exec -T database psql -U cycleline cycleline`. Copying dumps off the VM is manual.
- `## Extension points`: invite-only sign-up, a custom domain with a reverse proxy instead of Funnel, off-VM backup sync.
- `## Gotchas` (symptom → fix):
  - After a reboot the site is down → `tailscale funnel status`, re-run `tailscale funnel --bg 8000`; verify `curl https://<vm>.<tailnet>.ts.net/api/health`.
  - VM, host or Funnel down → the Vercel app shows errors; Funnel has bandwidth limits, fine for a pilot only.
  - Funnel only listens on 443/8443/10000.
  - `docker compose down --volumes` does not delete data (bind mount); delete `/srv/cycleline/pgdata` to reset.
  - Riders cannot reset their own password (`MAIL_MAILER=log`, `backend/.env.example:51`); an admin must.
  - Limiter: a known account can be locked out for a minute; a 120/min flood can 429 everyone (availability only).
  - `SEED_DATABASE=true` recreates a deleted `admin`/`alexrider` with the public password.
  - Pilot users' emails are personal data stored on the operator's VM; tell them.

- [ ] **Step 2: Add the index row**

In `docs/project/README.md`, add to the files table:

```
| [deployment-vm.md](deployment-vm.md) | Run API + Postgres on a VM behind Tailscale Funnel, frontend on Vercel |
```

- [ ] **Step 3: Check budgets and links**

Run: `wc -l docs/project/deployment-vm.md docs/project/README.md`
Expected: `deployment-vm.md` ≤ 150 lines, `README.md` ≤ 60 lines. Confirm every referenced path exists.

- [ ] **Step 4: Commit**

```bash
git add docs/project/deployment-vm.md docs/project/README.md
git commit -m "docs: add VM deployment runbook"
```

### Task 5: Verify on the VM (manual, operator)

No repo files. Follow `docs/project/deployment-vm.md` on the Ubuntu VM, then check each item:

- [ ] **Step 1:** `docker compose -f compose.yaml -f compose.vm.yaml --env-file .env.vm config`. Expected: renders without errors; backend `ports` shows only `127.0.0.1:8000`; database volume is `/srv/cycleline/pgdata`.
- [ ] **Step 2:** Start the stack, then `docker compose -f compose.yaml -f compose.vm.yaml --env-file .env.vm ps`. Expected: `database` and `backend` healthy.
- [ ] **Step 3:** `curl localhost:8000/api/health`, then `curl https://<vm>.<tailnet>.ts.net/api/health` from another network. Expected: `{"status":"ok","service":"cycleline-api"}` both times; port 8000 is not reachable on the VM's LAN IP.
- [ ] **Step 4:** Deploy on Vercel; register a new account in the app; restart the stack; log in again. Expected: the account persists.
- [ ] **Step 5:** Reset `admin` and `alexrider` passwords; set `SEED_DATABASE=false`; re-run the up command. Expected: demo passwords no longer work.
- [ ] **Step 6:** Run `scripts/vm-backup.sh`; restore the dump into a scratch database. Expected: user rows present.
- [ ] **Step 7:** Reboot the VM. Expected: stack and Funnel return; `/api/health` answers via the public URL.
- [ ] **Step 8:** Send 11 bad logins for one username through the Vercel app. Expected: the 11th is rejected (generic login failure) and another username can still log in.
