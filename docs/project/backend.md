# Backend (Laravel API)

## Purpose
JSON API for accounts, profile, bikes, routes, suggestions, news and administration. Endpoint contract: [../API.md](../API.md).

## Key files
- `backend/routes/api.php` → every endpoint; groups: public, `auth:sanctum`, `admin`
- `backend/app/Controllers/*.php` → Auth, User, Bike, Routes, News, Admin (plain classes)
- `backend/app/Http/Middleware/EnsureAdmin.php` → 403 JSON unless `is_admin` (`:13`)
- `backend/app/Models/*.php` → `$fillable` + `$casts` + relations
- `backend/tests/Feature/` → Pest, `RefreshDatabase` bound in `tests/Pest.php:17-19`
- `backend/phpunit.xml` → tests use in-memory SQLite (`:25-26`)

## How it works
- Login deletes prior `cycleline-web` tokens, then issues a new one (`AuthController.php:48`).
- Bike create/update run in `DB::transaction` to keep a single default (`BikeController.php:24,45`).
- Route suggestions: `GET /routes/suggestions` before `apiResource('/routes')` (`api.php:27-28`); logic at `RoutesController.php:56`.
- Admin: reset-data runs in a transaction (`AdminController.php:63`); reset-password deletes all tokens (`:84`).
- News: slug = slug(title) + 5 random chars (`NewsController.php:122`); `generate-draft` returns a templated draft, no external AI (`:77-95`).
- Public news only returns `status = published` (`NewsController.php:17`, `:30`).

## Extension points
- Add middleware aliases in `bootstrap/app.php:13-15`.
- Add endpoints inside the correct group in `routes/api.php`.

## Gotchas
- Controllers are in `App\Controllers`, not `App\Http\Controllers` (`Controllers/` + stub `Http/Controllers/Controller.php`).
- `Route` model has no `user_id` in `$fillable` (`Models/Route.php:13-31`); create via `$user->routes()`.
- Route name collision: `App\Models\Route` vs `Illuminate\Support\Facades\Route` (`routes/api.php:9`).
