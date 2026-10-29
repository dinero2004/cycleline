<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

it('registers and logs in a rider', function () {
    $this->postJson('/api/auth/register', [
        'email' => 'new@cycleline.test',
        'username' => 'newrider',
        'password' => 'ride66',
        'password_confirmation' => 'ride66',
    ])->assertCreated()
        ->assertJsonPath('user.username', 'newrider');

    $this->postJson('/api/auth/login', [
        'login' => 'newrider',
        'password' => 'ride66',
    ])->assertOk()
        ->assertJsonStructure(['user', 'token']);
});

it('keeps routes owned by their rider', function () {
    $rider = User::create([
        'email' => 'owner@cycleline.test',
        'username' => 'owner',
        'password' => Hash::make('SecureRide!9'),
    ]);
    $other = User::create([
        'email' => 'other@cycleline.test',
        'username' => 'other',
        'password' => Hash::make('SecureRide!9'),
    ]);

    $route = $rider->routes()->create([
        'name' => 'Morning loop',
        'start_name' => 'Zurich',
        'end_name' => 'Baden',
        'start_lat' => 47.37,
        'start_lng' => 8.54,
        'end_lat' => 47.47,
        'end_lng' => 8.30,
        'distance_km' => 28.5,
        'duration_minutes' => 90,
        'difficulty' => 'beginner',
        'route_type' => 'one-way',
        'profile' => 'road',
        'coordinates' => [[47.37, 8.54], [47.47, 8.30]],
    ]);

    $this->actingAs($other)
        ->getJson("/api/routes/{$route->id}")
        ->assertNotFound();

    $this->actingAs($rider)
        ->getJson("/api/routes/{$route->id}")
        ->assertOk()
        ->assertJsonPath('route.name', 'Morning loop');
});

it('stores Route Studio details with a saved route', function () {
    $rider = User::create([
        'email' => 'studio@cycleline.test',
        'username' => 'studio',
        'password' => Hash::make('SecureRide!9'),
    ]);

    $payload = [
        'name' => 'Pfannenstiel gravel ride',
        'start_name' => 'Zürich, Bellevue',
        'end_name' => 'Meilen',
        'start_lat' => 47.3667,
        'start_lng' => 8.545,
        'end_lat' => 47.2697,
        'end_lng' => 8.6436,
        'distance_km' => 22.7,
        'duration_minutes' => 88,
        'elevation_gain_m' => 551,
        'difficulty' => 'intermediate',
        'route_type' => 'one-way',
        'profile' => 'gravel',
        'coordinates' => [[47.3667, 8.545], [47.2965, 8.6733], [47.2697, 8.6436]],
        'details' => [
            'ride_profile' => 'gravel',
            'provider' => 'brouter',
            'waypoints' => [[47.3667, 8.545], [47.2697, 8.6436]],
            'elevation' => [['d' => 0, 'e' => 408], ['d' => 22665, 'e' => 420]],
            'surface_mix' => ['paved' => 12023, 'gravel' => 10642, 'trail' => 0, 'unknown' => 0],
            'descent_m' => 540,
            'max_grade_pct' => 14,
            'warnings' => ['Steep: over 8% for 400 m'],
        ],
    ];

    $this->actingAs($rider)
        ->postJson('/api/routes', $payload)
        ->assertCreated()
        ->assertJsonPath('route.details.surface_mix.gravel', 10642)
        ->assertJsonPath('route.details.max_grade_pct', 14);

    $this->actingAs($rider)
        ->postJson('/api/routes', [...$payload, 'details' => ['unexpected' => true]])
        ->assertUnprocessable();
});
