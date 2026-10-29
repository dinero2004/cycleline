<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }

        // Calls arrive from Vercel's servers, so per-IP keys would share one bucket.
        RateLimiter::for('auth', function (Request $request) {
            $identity = $request->input('login', $request->input('email', ''));
            $identity = is_string($identity) ? Str::lower($identity) : '';

            return [
                Limit::perMinute(10)->by('identity:'.$identity),
                Limit::perMinute(120)->by('auth-global'),
            ];
        });
    }
}
