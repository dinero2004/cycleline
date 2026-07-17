# API reference

Base URL in development: `http://127.0.0.1:8000/api`

All request and response bodies use JSON. Protected endpoints require:

```http
Authorization: Bearer <sanctum-token>
Accept: application/json
```

## Public endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Create a rider account |
| `POST` | `/auth/login` | Exchange credentials for a Sanctum token |
| `GET` | `/news` | List published news |
| `GET` | `/news/{slug}` | Read a published article |

### Register

```json
{
  "email": "rider@example.com",
  "username": "rider",
  "password": "SecureRide!9",
  "password_confirmation": "SecureRide!9"
}
```

### Login

The `login` value may be a username or email address.

```json
{
  "login": "rider",
  "password": "SecureRide!9"
}
```

## Rider endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/me` | Profile, bikes, and route count |
| `PATCH` | `/me` | Update profile, fitness, goals, or password |
| `POST` | `/auth/logout` | Revoke the active token |
| `GET` | `/bikes` | List the current rider’s bikes |
| `POST` | `/bikes` | Add a bike |
| `PATCH` | `/bikes/{bike}` | Update an owned bike |
| `DELETE` | `/bikes/{bike}` | Remove an owned bike |
| `GET` | `/routes` | List the current rider’s routes |
| `POST` | `/routes` | Save a calculated route |
| `GET` | `/routes/{route}` | Read an owned route |
| `PATCH` | `/routes/{route}` | Update an owned route |
| `DELETE` | `/routes/{route}` | Delete an owned route |
| `GET` | `/routes/suggestions` | Get fitness-aware route suggestions |

### Save route

Coordinates are stored as `[latitude, longitude]`.

```json
{
  "bike_id": 1,
  "name": "Limmat after-work line",
  "description": "Calm riverside spin.",
  "start_name": "Zürich Hauptbahnhof",
  "end_name": "Baden railway station",
  "start_lat": 47.3782,
  "start_lng": 8.5402,
  "end_lat": 47.4763,
  "end_lng": 8.3078,
  "distance_km": 28.6,
  "duration_minutes": 92,
  "elevation_gain_m": 210,
  "difficulty": "beginner",
  "route_type": "one-way",
  "profile": "gravel",
  "coordinates": [
    [47.3782, 8.5402],
    [47.4763, 8.3078]
  ]
}
```

## Administrator endpoints

Every endpoint below requires both Sanctum authentication and `is_admin = true`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/admin/dashboard` | Platform counts and distance |
| `GET` | `/admin/users` | Paginated user management list |
| `PATCH` | `/admin/users/{user}` | Update fitness or admin role |
| `POST` | `/admin/users/{user}/reset-data` | Delete routes/bikes and reset preferences |
| `POST` | `/admin/users/{user}/reset-password` | Set password and revoke all tokens |
| `DELETE` | `/admin/users/{user}` | Delete an account and owned records |
| `GET` | `/admin/news` | List drafts and published articles |
| `POST` | `/admin/news/generate-draft` | Generate an editable starter draft |
| `POST` | `/admin/news` | Create a draft or published article |
| `PATCH` | `/admin/news/{news}` | Update an article |
| `DELETE` | `/admin/news/{news}` | Delete an article |

## Error shape

Laravel validation errors use:

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": ["The email has already been taken."]
  }
}
```

Authorization returns `401` for missing/invalid tokens and `403` for an authenticated non-admin.
