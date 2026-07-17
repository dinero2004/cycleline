# Deployment

CycleLine has two independently deployable services:

- `frontend/`: Next.js 16 and Auth.js
- `backend/`: Laravel 12 JSON API

The recommended production topology is Vercel for the frontend and a Docker host with managed PostgreSQL for the API.

## Local production containers

Build and run the complete stack:

```bash
docker compose up --build
```

The services are then available at:

- Web: `http://localhost:3000`
- API health: `http://localhost:8000/api/health`
- API base URL: `http://localhost:8000/api`

The Compose configuration seeds demo data for local evaluation only. Its passwords and application secrets are intentionally development-only values.

Stop the stack with:

```bash
docker compose down
```

Add `--volumes` only when you intentionally want to delete the local PostgreSQL data.

## Frontend: Vercel

Create a Vercel project with `frontend/` as its Root Directory. Configure:

```env
AUTH_SECRET=<cryptographically-random-secret>
BACKEND_URL=https://your-api-host.example/api
```

`BACKEND_URL` is server-only. Browser requests go through Next.js Server Actions and Auth.js, so it must not use the `NEXT_PUBLIC_` prefix.

Recommended release flow:

1. Deploy a preview from a feature branch.
2. Run the browser acceptance scenarios against the preview.
3. Promote the verified deployment to production.
4. Keep Vercel Git integration enabled for automatic preview deployments.

## Backend: Render Docker + PostgreSQL

The repository includes `render.yaml`, which creates:

- A Docker web service from `backend/Dockerfile`
- A managed PostgreSQL database
- A health check at `/api/health`
- A startup migration before Apache begins accepting traffic

Before the first deployment, generate an application key locally:

```bash
cd backend
php artisan key:generate --show
```

Enter that complete `base64:...` value when Render prompts for `APP_KEY`.

The included free plans are suitable for a demonstration environment. Upgrade the API and database plans, enable backups, and choose a recovery policy before treating the deployment as production.

Do not run the demo seeder in a public production environment. Create the first administrator through a protected operational process instead of shipping a known password.

## Alternative: one container platform

For the simplest operational model, both Dockerfiles can run on Railway, Render, Fly.io, or Cloud Run. In that model:

- Keep PostgreSQL managed and outside the app containers.
- Set the frontend `BACKEND_URL` to the API service's private URL when the platform supports private networking.
- Put both services in the same European region to reduce login and dashboard latency.
- Scale the frontend and backend independently.

This is simpler to understand, but Vercel remains the stronger frontend target for Next.js previews, image optimization, CDN delivery, and instant rollback.

## Required production controls

- Change or remove all seeded credentials.
- Enforce HTTPS for both services.
- Enable PostgreSQL backups before exposing admin deletion/reset actions.
- Configure application monitoring, uptime checks, and rate limiting.
- Keep `AUTH_SECRET`, `APP_KEY`, database credentials, and Sanctum tokens out of Git.
- Run API tests, frontend checks, and both container builds before every release.
- Use a managed or self-hosted routing/geocoding service for sustained traffic.
