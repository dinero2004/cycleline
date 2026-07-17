<?php

namespace App\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController
{
    public function register(Request $request)
    {
        $payload = $request->validate([
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'username' => ['required', 'string', 'min:3', 'max:40', 'alpha_dash', 'unique:users,username'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $user = User::create([
            ...$payload,
            'password' => Hash::make($payload['password']),
        ]);

        return response()->json([
            'message' => 'Account created.',
            'user' => $this->userPayload($user),
        ], 201);
    }

    public function login(Request $request)
    {
        $payload = $request->validate([
            'login' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()
            ->where('username', $payload['login'])
            ->orWhere('email', $payload['login'])
            ->first();

        if (! $user || ! Hash::check($payload['password'], $user->password)) {
            return response()->json([
                'message' => 'The username, email, or password is incorrect.',
            ], 422);
        }

        $user->tokens()->where('name', 'cycleline-web')->delete();
        $token = $user->createToken('cycleline-web');

        return response()->json([
            'user' => $this->userPayload($user),
            'token' => $token->plainTextToken,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'fitness_level' => $user->fitness_level,
            'is_admin' => $user->is_admin,
        ];
    }
}
