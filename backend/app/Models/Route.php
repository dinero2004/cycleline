<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Route extends Model
{
    use HasFactory;

    protected $fillable = [
        'bike_id',
        'name',
        'description',
        'start_name',
        'end_name',
        'start_lat',
        'start_lng',
        'end_lat',
        'end_lng',
        'distance_km',
        'duration_minutes',
        'elevation_gain_m',
        'difficulty',
        'route_type',
        'profile',
        'coordinates',
        'is_favorite',
    ];

    protected $casts = [
        'coordinates' => 'array',
        'distance_km' => 'decimal:2',
        'start_lat' => 'float',
        'start_lng' => 'float',
        'end_lat' => 'float',
        'end_lng' => 'float',
        'is_favorite' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function bike(): BelongsTo
    {
        return $this->belongsTo(Bike::class);
    }
}
