# CycleLine API

Laravel 12 JSON API for accounts, profiles, bikes, routes, suggestions, news, and administration.

See the root [README](../README.md), [API reference](../docs/API.md), and [architecture guide](../docs/ARCHITECTURE.md).

## Commands

```bash
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate:fresh --seed
php artisan serve
```

Tests and formatting:

```bash
php artisan test
vendor/bin/pint --test
```
