# CycleLine

CycleLine is a rider-first cycling planner. It combines real map routing with a personal route library, bike garage, fitness-aware suggestions, a public news journal, and a protected administration area.

This repository is a full rebuild of the original Create React App prototype.

## What works

- Account registration and credentials login
- Laravel Sanctum token authentication through Auth.js
- One user → many saved routes
- One user → many bikes, with a selectable default bike
- Live place search through Nominatim
- Real cycling route geometry through BRouter
- One-way and return route calculation
- Distance, duration, elevation, difficulty, and GPX download
- Fitness-aware route suggestions
- Rider profile, weekly distance goal, and preferred distance
- Public cycling news journal
- Admin user/role management, password reset, ride-data reset, and deletion
- Admin news draft generation, draft saving, publishing, and deletion
- Responsive UI, keyboard-visible controls, reduced-motion support, and mobile navigation

## Stack

| Layer | Technology |
| --- | --- |
| Web application | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4 foundation + custom design system |
| Authentication | Auth.js credentials provider + Laravel Sanctum |
| API | Laravel 12, PHP 8.2+ |
| Local database | SQLite |
| Production database | PostgreSQL or MySQL |
| Maps | React Leaflet + OpenStreetMap |
| Geocoding | Nominatim |
| Cycling routes | BRouter |
| Testing | Pest, PHPUnit, TypeScript, ESLint, Next production build |

## Quick start

Requirements:

- PHP 8.2+
- Composer 2
- Node.js 20.19+, 22.13+, or 24+
- npm 10+

### 1. Start the API

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate:fresh --seed
php artisan serve
```

The API is available at `http://127.0.0.1:8000/api`.

### 2. Start the web app

In another terminal:

```bash
cd frontend
npm install
cp .env.example .env.local
```

Generate a development Auth.js secret:

```bash
npx auth secret
```

Then run:

```bash
npm run dev
```

Open `http://localhost:3000`.

### Demo accounts

| Role | Username | Password |
| --- | --- | --- |
| Rider | `alexrider` | `CycleLine!2026` |
| Admin | `admin` | `CycleLine!2026` |

Change or remove seeded credentials before using a public environment.

## Repository layout

```text
.
├── backend/                 Laravel JSON API
│   ├── app/Controllers/     Auth, routes, bikes, profile, news, admin
│   ├── app/Models/          User, Route, Bike, News
│   ├── database/            Migrations and realistic demo seed data
│   ├── routes/api.php       Public, rider, and administrator endpoints
│   └── tests/Feature/       Ownership, authentication, and admin tests
├── frontend/                Next.js TypeScript application
│   ├── src/app/             App Router pages, actions, and route proxies
│   ├── src/components/      Product UI and route-planning components
│   ├── src/lib/             Typed backend client
│   └── src/types/           Shared frontend domain types
└── docs/                    Architecture and API reference
```

## Quality checks

```bash
# API
cd backend
php artisan test
vendor/bin/pint --test

# Web
cd frontend
npm run typecheck
npm run lint
npm run build
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API reference](docs/API.md)
- [Deployment guide](docs/DEPLOYMENT.md)

## Map-service note

The included Nominatim and BRouter integrations are excellent for development and light usage. A production product with meaningful traffic should use a managed provider or a self-hosted instance and respect each service’s usage policy.
