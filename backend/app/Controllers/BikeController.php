<?php

namespace App\Controllers;

use App\Models\Bike;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class BikeController
{
    public function index(Request $request)
    {
        return response()->json([
            'bikes' => $request->user()->bikes()->latest()->get(),
        ]);
    }

    public function store(Request $request)
    {
        $payload = $this->validateBike($request);
        $user = $request->user();

        $bike = DB::transaction(function () use ($user, $payload) {
            $makeDefault = ($payload['is_default'] ?? false) || ! $user->bikes()->exists();

            if ($makeDefault) {
                $user->bikes()->update(['is_default' => false]);
            }

            return $user->bikes()->create([
                ...$payload,
                'is_default' => $makeDefault,
            ]);
        });

        return response()->json(['bike' => $bike], 201);
    }

    public function update(Request $request, Bike $bike)
    {
        $this->authorizeOwner($request, $bike);
        $payload = $this->validateBike($request, true);

        DB::transaction(function () use ($request, $bike, $payload) {
            if ($payload['is_default'] ?? false) {
                $request->user()->bikes()->whereKeyNot($bike->id)->update(['is_default' => false]);
            }
            $bike->update($payload);
        });

        return response()->json(['bike' => $bike->fresh()]);
    }

    public function destroy(Request $request, Bike $bike)
    {
        $this->authorizeOwner($request, $bike);
        $wasDefault = $bike->is_default;
        $bike->delete();

        if ($wasDefault) {
            $request->user()->bikes()->oldest()->first()?->update(['is_default' => true]);
        }

        return response()->json(['message' => 'Bike removed.']);
    }

    private function validateBike(Request $request, bool $partial = false): array
    {
        $prefix = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$prefix, 'string', 'min:2', 'max:80'],
            'type' => [$prefix, Rule::in(['road', 'gravel', 'mountain', 'city', 'electric', 'touring'])],
            'weight_kg' => ['nullable', 'numeric', 'min:3', 'max:40'],
            'is_default' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string', 'max:300'],
        ]);
    }

    private function authorizeOwner(Request $request, Bike $bike): void
    {
        abort_unless($bike->user_id === $request->user()->id, 404);
    }
}
