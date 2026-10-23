# Data model

## Purpose
Four app tables plus Sanctum tokens. ER diagram: [../ARCHITECTURE.md](../ARCHITECTURE.md).

## Key files
- `backend/database/migrations/000_personal_access_tokens.php` → Sanctum tokens
- `010_users.php`, `020_bikes.php`, `030_routes.php`, `040_news.php` → app tables
- `backend/app/Models/` → relations and casts
- `backend/database/seeders/DatabaseSeeder.php` → demo `admin` and `alexrider` users

## How it works
- `users`: unique `email`/`username`, `fitness_level` (default `beginner`), `is_admin` (`010_users.php:11-18`).
- `bikes`: `user_id` cascade, `is_default` flag (`020_bikes.php:38-42`).
- `routes`: `user_id` cascade, `bike_id` nullable → `nullOnDelete`, `coordinates` JSON (`030_routes.php:13-30`).
- `news`: `author_id` → users cascade, unique `slug`, `status` default `draft` (`040_news.php`).
- Models: `User` has `routes()`, `bikes()`, `news()` (author_id) (`User.php:38-50`).

## Extension points
- Add a migration numbered after `040_`; add `$fillable`/`$casts` to the model.

## Gotchas
- Migration filenames are numeric prefixes, not timestamps.
- `status` and `route_type` are plain strings; allowed values are enforced in controllers (`NewsController.php:116`), not the DB.
