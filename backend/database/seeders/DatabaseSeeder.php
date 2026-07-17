<?php

namespace Database\Seeders;

use App\Models\News;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::firstOrCreate(
            ['username' => 'admin'],
            [
                'email' => 'admin@cycleline.test',
                'password' => Hash::make('CycleLine!2026'),
                'bio' => 'CycleLine operations and editorial team.',
                'fitness_level' => 'advanced',
                'weekly_distance_goal' => 180,
                'preferred_distance' => 65,
                'is_admin' => true,
            ],
        );

        $rider = User::firstOrCreate(
            ['username' => 'alexrider'],
            [
                'email' => 'rider@cycleline.test',
                'password' => Hash::make('CycleLine!2026'),
                'bio' => 'Weekend gravel rider, coffee-stop enthusiast.',
                'fitness_level' => 'intermediate',
                'weekly_distance_goal' => 120,
                'preferred_distance' => 42,
            ],
        );

        $bike = $rider->bikes()->updateOrCreate(
            ['name' => 'Moss'],
            [
                'type' => 'gravel',
                'weight_kg' => 9.4,
                'is_default' => true,
                'notes' => '42 mm tyres, ready for mixed surfaces.',
            ],
        );

        $rider->routes()->updateOrCreate(
            ['name' => 'Limmat after-work line'],
            [
                'bike_id' => $bike->id,
                'description' => 'A calm spin west with long riverside sections.',
                'start_name' => 'Zürich Hauptbahnhof',
                'end_name' => 'Baden railway station',
                'start_lat' => 47.3782,
                'start_lng' => 8.5402,
                'end_lat' => 47.4763,
                'end_lng' => 8.3078,
                'distance_km' => 28.6,
                'duration_minutes' => 92,
                'elevation_gain_m' => 210,
                'difficulty' => 'beginner',
                'route_type' => 'one-way',
                'profile' => 'gravel',
                'coordinates' => [
                    [47.3782, 8.5402],
                    [47.3951, 8.5008],
                    [47.4254, 8.4372],
                    [47.4560, 8.3714],
                    [47.4763, 8.3078],
                ],
                'is_favorite' => true,
            ],
        );

        foreach ([
            [
                'title' => 'Zurich opens a quieter line west',
                'slug' => 'zurich-opens-a-quieter-line-west',
                'excerpt' => 'A connected riverside section makes the city-to-Baden ride easier to follow and more comfortable at peak hours.',
                'body' => "A small missing link on the Limmat corridor is now open.\n\nThe change gives riders a calmer alternative to two busy junctions and improves the connection toward Baden. CycleLine recommends checking temporary signs during the first weeks and keeping speed low where the path is shared.",
                'category' => 'Local',
                'image_url' => '/images/cycling/city-community.png',
            ],
            [
                'title' => 'Five checks before your first long ride',
                'slug' => 'five-checks-before-your-first-long-ride',
                'excerpt' => 'Tyres, brakes, snacks, layers, and a realistic route: the short pre-ride list that prevents long roadside stops.',
                'body' => "Long rides become much simpler when the basics are settled before you leave.\n\nSet tyre pressure for the surface, test both brakes, pack food you already know, carry one extra layer, and save an achievable route. The best training day is the one you can finish with enough energy to recover.",
                'category' => 'Training',
                'image_url' => '/images/cycling/workshop-check.png',
            ],
            [
                'title' => 'Gravel setup: comfort is speed',
                'slug' => 'gravel-setup-comfort-is-speed',
                'excerpt' => 'A practical guide to tyre width, pressure, and contact points for smoother mixed-surface days.',
                'body' => "The fastest gravel setup is rarely the harshest one.\n\nStart with tyre pressure, then check saddle position, bar angle, and reach. Make one change at a time and test it on a familiar loop. Comfort lets you hold a steady effort when the surface becomes rough.",
                'category' => 'Gear',
                'image_url' => '/images/cycling/gravel-forest.png',
            ],
            [
                'title' => 'How to build a safer night-riding route',
                'slug' => 'how-to-build-a-safer-night-riding-route',
                'excerpt' => 'A route-first approach to lighting, quieter streets, battery planning, and the final kilometres home.',
                'body' => "A good night ride begins with the line, not the lights.\n\nChoose roads you already understand, favour protected or low-traffic sections, and avoid complicated junctions when visibility drops. Charge both lights, carry a small backup, and save a route that still makes sense if you need to shorten the ride.\n\nReflective details help other road users read your movement, while steady pacing leaves more attention for the road ahead.",
                'category' => 'Safety',
                'image_url' => '/images/cycling/alpine-riders.png',
            ],
            [
                'title' => 'The recovery loop that still feels like a ride',
                'slug' => 'the-recovery-loop-that-still-feels-like-a-ride',
                'excerpt' => 'Keep the legs moving without turning an easy day into another training session.',
                'body' => "Recovery rides work best when the route removes temptation.\n\nChoose flatter streets, protected lanes, and a distance that feels almost too short. Keep the cadence comfortable and let faster riders go. The goal is to finish looser than you started, not to collect another personal best.\n\nSave one dependable recovery loop in CycleLine so the easy choice is ready when tired legs make decisions harder.",
                'category' => 'Training',
                'image_url' => '/images/cycling/city-community.png',
            ],
            [
                'title' => 'Pack a gravel route without packing the whole garage',
                'slug' => 'pack-a-gravel-route-without-the-whole-garage',
                'excerpt' => 'The compact repair, food, and layer checklist for a mixed-surface day away from busy roads.',
                'body' => "Carry for the route you planned and the conditions you can reasonably expect.\n\nA tube, plugs, a compact pump, tyre lever, multitool, food, water, and one useful layer cover most mixed-surface rides. Add a small first-aid kit when the line runs far from towns.\n\nCheck where the route returns to reliable roads before leaving. Good preparation should make the bike feel ready, not overloaded.",
                'category' => 'Gear',
                'image_url' => '/images/cycling/gravel-forest.png',
            ],
        ] as $article) {
            News::updateOrCreate(
                ['slug' => $article['slug']],
                [
                    ...$article,
                    'author_id' => $admin->id,
                    'status' => 'published',
                    'published_at' => now(),
                ],
            );
        }
    }
}
