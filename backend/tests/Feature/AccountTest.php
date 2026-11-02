<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

function rider(): User
{
    return User::create([
        'email' => 'rider@cycleline.test',
        'username' => 'rider',
        'password' => Hash::make('OldRide!9'),
    ]);
}

it('changes the password only with the current one', function () {
    $user = rider();
    $this->actingAs($user, 'sanctum');

    $this->putJson('/api/me/password', [
        'current_password' => 'wrong-one',
        'password' => 'NewRide!9',
        'password_confirmation' => 'NewRide!9',
    ])->assertUnprocessable()->assertJsonValidationErrors('current_password');

    $this->putJson('/api/me/password', [
        'current_password' => 'OldRide!9',
        'password' => 'NewRide!9',
        'password_confirmation' => 'NewRide!9',
    ])->assertOk();

    expect(Hash::check('NewRide!9', $user->fresh()->password))->toBeTrue();
});

it('no longer changes the password through the profile update', function () {
    $user = rider();
    $this->actingAs($user, 'sanctum');

    $this->patchJson('/api/me', [
        'password' => 'Sneaky!99',
        'password_confirmation' => 'Sneaky!99',
    ])->assertOk();

    expect(Hash::check('OldRide!9', $user->fresh()->password))->toBeTrue();
});

it('deletes the account with its routes and bikes after the password', function () {
    $user = rider();
    $user->bikes()->create(['name' => 'Moss', 'type' => 'gravel']);
    $this->actingAs($user, 'sanctum');

    $this->deleteJson('/api/me', ['password' => 'wrong-one'])
        ->assertUnprocessable()->assertJsonValidationErrors('password');
    expect(User::find($user->id))->not->toBeNull();

    $this->deleteJson('/api/me', ['password' => 'OldRide!9'])->assertNoContent();
    expect(User::find($user->id))->toBeNull();
    $this->assertDatabaseMissing('bikes', ['user_id' => $user->id]);
});

it('requires a session for account changes', function () {
    $this->putJson('/api/me/password', [])->assertUnauthorized();
    $this->deleteJson('/api/me', [])->assertUnauthorized();
});

it('limits password checks per rider', function () {
    $user = rider();
    $this->actingAs($user, 'sanctum');

    foreach (range(1, 6) as $attempt) {
        $this->deleteJson('/api/me', ['password' => 'wrong-one'])->assertUnprocessable();
    }
    $this->deleteJson('/api/me', ['password' => 'wrong-one'])->assertTooManyRequests();
});
