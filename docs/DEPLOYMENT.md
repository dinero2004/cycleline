# Deployment

CycleLine has two deployable services.

## Web application

Deploy `frontend/` to Vercel.

Required environment variables:

```env
AUTH_SECRET=<long random value>
BACKEND_URL=https://api.example.com/api
```

The frontend calls Laravel from the Next.js server, so `BACKEND_URL` does not need to be public browser configuration.

## Laravel API

Deploy `backend/` to a PHP 8.2+ host with PostgreSQL or MySQL. Configure:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.example.com
APP_KEY=<generated Laravel key>

DB_CONNECTION=pgsql
DB_HOST=<host>
DB_PORT=5432
DB_DATABASE=<database>
DB_USERNAME=<user>
DB_PASSWORD=<password>
```

Then run:

```bash
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
```

Do not run the demo seeder in production.

## Production checklist

- Change or remove the seeded demo credentials.
- Enforce HTTPS for both services.
- Use a managed or self-hosted routing/geocoding service for sustained traffic.
- Add database backups before exposing admin deletion/reset actions.
- Configure application monitoring and rate limiting.
- Keep `AUTH_SECRET`, `APP_KEY`, database passwords, and Sanctum tokens out of Git.
- Run API tests and the frontend production build on every deployment.
