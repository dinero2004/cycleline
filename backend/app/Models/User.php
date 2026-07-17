<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'username',
        'email',
        'password',
        'bio',
        'fitness_level',
        'weekly_distance_goal',
        'preferred_distance',
        'is_admin',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'is_admin' => 'boolean',
        'weekly_distance_goal' => 'integer',
        'preferred_distance' => 'integer',
    ];

    public function routes(): HasMany
    {
        return $this->hasMany(Route::class);
    }

    public function bikes(): HasMany
    {
        return $this->hasMany(Bike::class);
    }

    public function news(): HasMany
    {
        return $this->hasMany(News::class, 'author_id');
    }
}
