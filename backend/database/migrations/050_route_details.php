<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Route Studio data: waypoints, elevation profile, surface mix and grades.
     * Nullable, so routes saved before it keep working.
     */
    public function up(): void
    {
        Schema::table('routes', function (Blueprint $table) {
            $table->json('details')->nullable()->after('coordinates');
        });
    }

    public function down(): void
    {
        Schema::table('routes', function (Blueprint $table) {
            $table->dropColumn('details');
        });
    }
};
