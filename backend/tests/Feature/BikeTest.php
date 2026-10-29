<?php

use App\Models\Bike;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

function createRider(string $username): User
{
    return User::create([
        'email' => "{$username}@cycleline.test",
        'username' => $username,
        'password' => Hash::make('SecureRide!9'),
    ]);
}

function bikePayload(string $name, bool $isDefault = false): array
{
    return [
        'name' => $name,
        'type' => 'road',
        'weight_kg' => 8.5,
        'is_default' => $isDefault,
    ];
}

it('makes a rider\'s first bike their default', function () {
    $rider = createRider('first-bike-rider');

    $this->actingAs($rider)
        ->postJson('/api/bikes', bikePayload('First bike'))
        ->assertCreated()
        ->assertJsonPath('bike.is_default', true);

    $this->assertDatabaseHas('bikes', [
        'user_id' => $rider->id,
        'name' => 'First bike',
        'is_default' => true,
    ]);
});

it('clears the previous default when a rider selects another bike', function () {
    $rider = createRider('default-switch-rider');
    $first = $rider->bikes()->create(bikePayload('First bike', true));
    $second = $rider->bikes()->create(bikePayload('Second bike'));

    $this->actingAs($rider)
        ->patchJson("/api/bikes/{$second->id}", ['is_default' => true])
        ->assertOk()
        ->assertJsonPath('bike.is_default', true);

    expect($first->fresh()->is_default)->toBeFalse()
        ->and($second->fresh()->is_default)->toBeTrue();
});

it('does not allow another rider to change or remove a bike', function () {
    $owner = createRider('bike-owner');
    $other = createRider('bike-other');
    $bike = $owner->bikes()->create(bikePayload('Private bike', true));

    $this->actingAs($other)
        ->patchJson("/api/bikes/{$bike->id}", ['name' => 'Stolen bike'])
        ->assertNotFound();

    $this->actingAs($other)
        ->deleteJson("/api/bikes/{$bike->id}")
        ->assertNotFound();

    expect($bike->fresh()->name)->toBe('Private bike');
});

it('promotes a remaining bike after deleting the default bike', function () {
    $rider = createRider('default-delete-rider');
    $default = $rider->bikes()->create(bikePayload('Default bike', true));
    $remaining = $rider->bikes()->create(bikePayload('Backup bike'));

    $this->actingAs($rider)
        ->deleteJson("/api/bikes/{$default->id}")
        ->assertOk();

    expect(Bike::find($default->id))->toBeNull()
        ->and($remaining->fresh()->is_default)->toBeTrue();
});
