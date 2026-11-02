<?php

namespace App\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserController
{
    public function show(Request $request)
    {
        return response()->json([
            'user' => $request->user()
                ->load('bikes')
                ->loadCount('routes'),
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->user();

        $payload = $request->validate([
            'email' => ['sometimes', 'email', Rule::unique('users')->ignore($user->id)],
            'username' => ['sometimes', 'string', 'min:3', 'max:40', 'alpha_dash', Rule::unique('users')->ignore($user->id)],
            'bio' => ['nullable', 'string', 'max:500'],
            'fitness_level' => ['sometimes', Rule::in(['beginner', 'intermediate', 'advanced'])],
            'weekly_distance_goal' => ['sometimes', 'integer', 'min:10', 'max:1000'],
            'preferred_distance' => ['sometimes', 'integer', 'min:5', 'max:300'],
        ]);

        $user->update($payload);

        return response()->json([
            'message' => 'Profile updated.',
            'user' => $user->fresh()->load('bikes')->loadCount('routes'),
        ]);
    }

    /** Password changes need the current password; see updatePassword. */
    public function updatePassword(Request $request)
    {
        $user = $request->user();

        $payload = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        if (! Hash::check($payload['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => 'That is not your current password.',
            ]);
        }

        $user->update(['password' => Hash::make($payload['password'])]);
        $user->tokens()->where('id', '!=', $user->currentAccessToken()?->id)->delete();

        return response()->json(['message' => 'Password changed.']);
    }

    /** Deletes the rider with their routes and bikes (cascading foreign keys). */
    public function destroy(Request $request)
    {
        $user = $request->user();

        $payload = $request->validate([
            'password' => ['required', 'string'],
        ]);

        if (! Hash::check($payload['password'], $user->password)) {
            throw ValidationException::withMessages([
                'password' => 'That password does not match your account.',
            ]);
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->noContent();
    }
}
