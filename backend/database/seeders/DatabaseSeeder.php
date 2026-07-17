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
        $admin = User::create([
            'email' => 'admin@cycleline.test',
            'username' => 'admin',
            'password' => Hash::make('CycleLine!2026'),
            'bio' => 'CycleLine operations and editorial team.',
            'fitness_level' => 'advanced',
            'weekly_distance_goal' => 180,
            'preferred_distance' => 65,
            'is_admin' => true,
        ]);

        $rider = User::create([
            'email' => 'rider@cycleline.test',
            'username' => 'alexrider',
            'password' => Hash::make('CycleLine!2026'),
            'bio' => 'Weekend gravel rider, coffee-stop enthusiast.',
            'fitness_level' => 'intermediate',
            'weekly_distance_goal' => 120,
            'preferred_distance' => 42,
        ]);

        $bike = $rider->bikes()->create([
            'name' => 'Moss',
            'type' => 'gravel',
            'weight_kg' => 9.4,
            'is_default' => true,
            'notes' => '42 mm tyres, ready for mixed surfaces.',
        ]);

        $rider->routes()->create([
            'bike_id' => $bike->id,
            'name' => 'Limmat after-work line',
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
        ]);

        foreach ([
            [
                'title' => 'Zurich opens a quieter line west',
                'slug' => 'zurich-opens-a-quieter-line-west',
                'excerpt' => 'A connected riverside section makes the city-to-Baden ride easier to follow and more comfortable at peak hours.',
                'body' => "A small missing link on the Limmat corridor is now open.\n\nThe change gives riders a calmer alternative to two busy junctions and improves the connection toward Baden. CycleLine recommends checking temporary signs during the first weeks and keeping speed low where the path is shared.",
                'category' => 'Local',
                'image_url' => 'https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=1600&q=85',
            ],
            [
                'title' => 'Five checks before your first long ride',
                'slug' => 'five-checks-before-your-first-long-ride',
                'excerpt' => 'Tyres, brakes, fuel, layers, and a realistic route: the short pre-ride list that prevents long roadside stops.',
                'body' => "Long rides become much simpler when the basics are settled before you leave.\n\nSet tyre pressure for the surface, test both brakes, pack food you already know, carry one extra layer, and save an achievable route. The best training day is the one you can finish with enough energy to recover.",
                'category' => 'Training',
                'image_url' => 'https://images.unsplash.com/photo-1502744688674-c619d1586c9e?auto=format&fit=crop&w=1600&q=85',
            ],
            [
                'title' => 'Gravel setup: comfort is speed',
                'slug' => 'gravel-setup-comfort-is-speed',
                'excerpt' => 'A practical guide to tyre width, pressure, and contact points for smoother mixed-surface days.',
                'body' => "The fastest gravel setup is rarely the harshest one.\n\nStart with tyre pressure, then check saddle position, bar angle, and reach. Make one change at a time and test it on a familiar loop. Comfort lets you hold a steady effort when the surface becomes rough.",
                'category' => 'Gear',
                'image_url' => 'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=1600&q=85',
            ],
        ] as $article) {
            News::create([
                ...$article,
                'author_id' => $admin->id,
                'status' => 'published',
                'published_at' => now(),
            ]);
        }
    }
}
