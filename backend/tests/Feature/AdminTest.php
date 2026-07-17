<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

it('blocks regular riders from the admin API', function () {
    $rider = User::create([
        'email' => 'rider@cycleline.test',
        'username' => 'rider',
        'password' => Hash::make('SecureRide!9'),
    ]);

    $this->actingAs($rider)
        ->getJson('/api/admin/dashboard')
        ->assertForbidden();
});

it('lets an admin reset a riders data', function () {
    $admin = User::create([
        'email' => 'admin@cycleline.test',
        'username' => 'admin',
        'password' => Hash::make('SecureRide!9'),
        'is_admin' => true,
    ]);
    $rider = User::create([
        'email' => 'rider@cycleline.test',
        'username' => 'rider',
        'password' => Hash::make('SecureRide!9'),
        'fitness_level' => 'advanced',
    ]);
    $rider->bikes()->create([
        'name' => 'Fast bike',
        'type' => 'road',
        'is_default' => true,
    ]);

    $this->actingAs($admin)
        ->postJson("/api/admin/users/{$rider->id}/reset-data")
        ->assertOk();

    expect($rider->fresh()->fitness_level)->toBe('beginner')
        ->and($rider->bikes()->count())->toBe(0);
});
