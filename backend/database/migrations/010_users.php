<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('email')->unique();
            $table->string('username', 40)->unique();
            $table->string('password');
            $table->text('bio')->nullable();
            $table->string('fitness_level')->default('beginner');
            $table->unsignedSmallInteger('weekly_distance_goal')->default(60);
            $table->unsignedSmallInteger('preferred_distance')->default(25);
            $table->boolean('is_admin')->default(false);
            $table->rememberToken();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
