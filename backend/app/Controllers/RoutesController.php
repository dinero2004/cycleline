<?php

namespace App\Controllers;

use App\Models\Route;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RoutesController
{
    public function index(Request $request)
    {
        $routes = $request->user()
            ->routes()
            ->with('bike:id,name,type')
            ->latest()
            ->get();

        return response()->json(['routes' => $routes]);
    }

    public function show(Request $request, Route $route)
    {
        $this->authorizeOwner($request, $route);

        return response()->json(['route' => $route->load('bike:id,name,type')]);
    }

    public function store(Request $request)
    {
        $payload = $this->validateRoute($request);
        $this->validateBikeOwnership($request, $payload['bike_id'] ?? null);
        $route = $request->user()->routes()->create($payload);

        return response()->json(['route' => $route->load('bike:id,name,type')], 201);
    }

    public function update(Request $request, Route $route)
    {
        $this->authorizeOwner($request, $route);
        $payload = $this->validateRoute($request, true);
        $this->validateBikeOwnership($request, $payload['bike_id'] ?? null);
        $route->update($payload);

        return response()->json(['route' => $route->fresh()->load('bike:id,name,type')]);
    }

    public function destroy(Request $request, Route $route)
    {
        $this->authorizeOwner($request, $route);
        $route->delete();

        return response()->json(['message' => 'Route deleted.']);
    }

    public function suggestions(Request $request)
    {
        $user = $request->user()->load('bikes');
        $averageDistance = (float) ($user->routes()->avg('distance_km') ?: $user->preferred_distance);
        $levelTargets = ['beginner' => 18, 'intermediate' => 38, 'advanced' => 68];
        $target = max($levelTargets[$user->fitness_level], (int) round($averageDistance));
        $defaultBike = $user->bikes->firstWhere('is_default', true) ?? $user->bikes->first();

        $suggestions = [
            [
                'id' => 'lake-zurich',
                'title' => 'Lake Zurich tempo ride',
                'start_name' => 'Bürkliplatz, Zürich',
                'end_name' => 'Rapperswil railway station',
                'start' => [47.3663, 8.5414],
                'end' => [47.2266, 8.8184],
                'distance_km' => max(32, min(48, $target)),
                'difficulty' => $user->fitness_level,
                'surface' => 'Paved lakeside roads',
            ],
            [
                'id' => 'limmat-flow',
                'title' => 'Limmat riverside flow',
                'start_name' => 'Zürich Hauptbahnhof',
                'end_name' => 'Baden railway station',
                'start' => [47.3782, 8.5402],
                'end' => [47.4763, 8.3078],
                'distance_km' => max(22, min(35, $target)),
                'difficulty' => $user->fitness_level === 'advanced' ? 'intermediate' : 'beginner',
                'surface' => 'Mixed cycleway and quiet roads',
            ],
            [
                'id' => 'uetliberg',
                'title' => 'Uetliberg climbing session',
                'start_name' => 'Zürich Enge',
                'end_name' => 'Uetliberg station',
                'start' => [47.3642, 8.5311],
                'end' => [47.3519, 8.4870],
                'distance_km' => max(14, min(26, $target - 8)),
                'difficulty' => 'advanced',
                'surface' => 'Steep road and compact gravel',
            ],
        ];

        return response()->json([
            'profile' => [
                'fitness_level' => $user->fitness_level,
                'target_distance_km' => $target,
                'bike' => $defaultBike,
            ],
            'suggestions' => $suggestions,
        ]);
    }

    private function validateRoute(Request $request, bool $partial = false): array
    {
        $prefix = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'bike_id' => ['nullable', 'integer', 'exists:bikes,id'],
            'name' => [$prefix, 'string', 'min:3', 'max:120'],
            'description' => ['nullable', 'string', 'max:1000'],
            'start_name' => [$prefix, 'string', 'max:255'],
            'end_name' => [$prefix, 'string', 'max:255'],
            'start_lat' => [$prefix, 'numeric', 'between:-90,90'],
            'start_lng' => [$prefix, 'numeric', 'between:-180,180'],
            'end_lat' => [$prefix, 'numeric', 'between:-90,90'],
            'end_lng' => [$prefix, 'numeric', 'between:-180,180'],
            'distance_km' => [$prefix, 'numeric', 'min:0.1', 'max:1000'],
            'duration_minutes' => [$prefix, 'integer', 'min:1', 'max:10000'],
            'elevation_gain_m' => ['sometimes', 'integer', 'min:0', 'max:30000'],
            'difficulty' => [$prefix, Rule::in(['beginner', 'intermediate', 'advanced'])],
            'route_type' => [$prefix, Rule::in(['one-way', 'round-trip'])],
            'profile' => [$prefix, Rule::in(['road', 'gravel', 'mountain', 'city', 'electric', 'touring'])],
            'coordinates' => [$prefix, 'array', 'min:2'],
            'coordinates.*' => ['array', 'size:2'],
            'coordinates.*.0' => ['numeric', 'between:-90,90'],
            'coordinates.*.1' => ['numeric', 'between:-180,180'],
            'is_favorite' => ['sometimes', 'boolean'],
        ]);
    }

    private function validateBikeOwnership(Request $request, ?int $bikeId): void
    {
        if ($bikeId !== null) {
            abort_unless(
                $request->user()->bikes()->whereKey($bikeId)->exists(),
                422,
                'That bike does not belong to this account.',
            );
        }
    }

    private function authorizeOwner(Request $request, Route $route): void
    {
        abort_unless($route->user_id === $request->user()->id, 404);
    }
}
