# Gates

Run every gate in the foreground with an explicit timeout. Split long suites to finish within it. Never run final-gate checks per item. Commands as declared in `AGENTS.md`, `frontend/package.json:12-13`, `README.md:128-135`.

## Per-item gate (every `coder`, before opening a PR; all green)
Run only the half(s) the diff touches.

| # | Dir | Command | Timeout |
|---|---|---|---|
| 1 | `frontend/` | `npm run typecheck` | 180s |
| 2 | `frontend/` | `npm run lint` | 180s |
| 3 | `backend/` | `vendor/bin/pint --test` | 120s |
| 4 | `backend/` | `php artisan test --testsuite=Feature` | 300s |

Prereqs: `npm ci` in `frontend/`, `composer install` in `backend/`, `backend/.env` from `.env.example` with `php artisan key:generate` (see `UNVERIFIED` below).

## Final gate (once per batch, on the integration branch)
1. All per-item gate commands, both halves.
2. `npm run build` in `frontend/` (timeout 600s) — `README.md:135`.

`docker compose build` is not in the gate (docker not installed locally). No CI exists in the repo (no `.github/workflows`), so CI parity is not checked.

## Warnings
- No frontend test runner is configured (`frontend/package.json` has no `test` script); frontend gates are typecheck + lint only.
- Plain `php artisan test` fails at baseline: `backend/phpunit.xml:8` lists `tests/Unit`, which doesn't exist. Use `--testsuite=Feature`.
- Local PHP is 8.5 (Homebrew): tests report `DEPR` (PDO::MYSQL_ATTR_SSL_CA, `backend/config/database.php:81`) though assertions pass; `backend/Dockerfile:3` and `composer.json:12` target PHP 8.2–8.4.
- Backend tests use in-memory SQLite via `backend/phpunit.xml:25-26`; they never touch a real database.
- `.env*` files are git-ignored; never commit them (`.gitignore:9-11`).
