<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

it('registers and logs in a rider', function () {
    $this->postJson('/api/auth/register', [
        'email' => 'new@cycleline.test',
        'username' => 'newrider',
        'password' => 'SecureRide!9',
        'password_confirmation' => 'SecureRide!9',
    ])->assertCreated()
        ->assertJsonPath('user.username', 'newrider');

    $this->postJson('/api/auth/login', [
        'login' => 'newrider',
        'password' => 'SecureRide!9',
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
