<?php

use App\Models\News;
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

it('lets an admin edit a ride journal article', function () {
    $admin = User::create([
        'email' => 'editor@cycleline.test',
        'username' => 'editor',
        'password' => Hash::make('ride66'),
        'is_admin' => true,
    ]);
    $article = News::create([
        'author_id' => $admin->id,
        'title' => 'Original ride story',
        'slug' => 'original-ride-story',
        'excerpt' => 'A useful original excerpt for riders planning their next trip.',
        'body' => str_repeat('Original cycling guidance with practical detail. ', 3),
        'category' => 'Local',
        'status' => 'draft',
    ]);

    $this->actingAs($admin)
        ->patchJson("/api/admin/news/{$article->id}", [
            'title' => 'Updated ride story',
            'excerpt' => 'An updated excerpt with clearer advice for the cycling community.',
            'body' => str_repeat('Updated route guidance with practical cycling detail. ', 3),
            'category' => 'Community',
            'image_url' => '/images/cycling/city-community.png',
            'status' => 'published',
        ])
        ->assertOk()
        ->assertJsonPath('article.title', 'Updated ride story')
        ->assertJsonPath('article.status', 'published');
});
