<?php

namespace App\Controllers;

use App\Models\Bike;
use App\Models\News;
use App\Models\Route;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class AdminController
{
    public function dashboard()
    {
        return response()->json([
            'stats' => [
                'users' => User::count(),
                'routes' => Route::count(),
                'distance_km' => round((float) Route::sum('distance_km'), 1),
                'bikes' => Bike::count(),
                'published_articles' => News::where('status', 'published')->count(),
            ],
        ]);
    }

    public function users(Request $request)
    {
        $users = User::query()
            ->withCount(['routes', 'bikes'])
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search').'%';
                $query->where(fn ($inner) => $inner
                    ->where('username', 'like', $term)
                    ->orWhere('email', 'like', $term));
            })
            ->latest()
            ->paginate(min($request->integer('limit', 25), 100));

        return response()->json($users);
    }

    public function updateUser(Request $request, User $user)
    {
        $payload = $request->validate([
            'fitness_level' => ['sometimes', Rule::in(['beginner', 'intermediate', 'advanced'])],
            'is_admin' => ['sometimes', 'boolean'],
        ]);

        if ($user->is($request->user()) && array_key_exists('is_admin', $payload) && ! $payload['is_admin']) {
            return response()->json(['message' => 'You cannot remove your own admin access.'], 422);
        }

        $user->update($payload);

        return response()->json(['user' => $user->fresh()->loadCount(['routes', 'bikes'])]);
    }

    public function resetData(User $user)
    {
        DB::transaction(function () use ($user) {
            $user->routes()->delete();
            $user->bikes()->delete();
            $user->update([
                'bio' => null,
                'fitness_level' => 'beginner',
                'weekly_distance_goal' => 60,
                'preferred_distance' => 25,
            ]);
        });

        return response()->json(['message' => "Ride data for {$user->username} was reset."]);
    }

    public function resetPassword(Request $request, User $user)
    {
        $payload = $request->validate([
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $user->update(['password' => Hash::make($payload['password'])]);
        $user->tokens()->delete();

        return response()->json(['message' => "Password reset for {$user->username}."]);
    }

    public function destroyUser(Request $request, User $user)
    {
        if ($user->is($request->user())) {
            return response()->json(['message' => 'You cannot delete your own admin account.'], 422);
        }

        $username = $user->username;
        $user->delete();

        return response()->json(['message' => "{$username} was deleted."]);
    }
}
