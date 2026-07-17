<?php

namespace App\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

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
            'password' => ['sometimes', 'string', 'min:8', 'confirmed'],
        ]);

        if (isset($payload['password'])) {
            $payload['password'] = Hash::make($payload['password']);
        }

        $user->update($payload);

        return response()->json([
            'message' => 'Profile updated.',
            'user' => $user->fresh()->load('bikes')->loadCount('routes'),
        ]);
    }
}
