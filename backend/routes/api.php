<?php

use App\Controllers\AdminController;
use App\Controllers\AuthController;
use App\Controllers\BikeController;
use App\Controllers\NewsController;
use App\Controllers\RoutesController;
use App\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => response()->json([
    'status' => 'ok',
    'service' => 'cycleline-api',
]));

Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);
Route::get('/news', [NewsController::class, 'index']);
Route::get('/news/{news:slug}', [NewsController::class, 'show']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [UserController::class, 'show']);
    Route::patch('/me', [UserController::class, 'update']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::apiResource('/bikes', BikeController::class)->except(['show']);
    Route::get('/routes/suggestions', [RoutesController::class, 'suggestions']);
    Route::apiResource('/routes', RoutesController::class);

    Route::prefix('admin')->middleware('admin')->group(function () {
        Route::get('/dashboard', [AdminController::class, 'dashboard']);
        Route::get('/users', [AdminController::class, 'users']);
        Route::patch('/users/{user}', [AdminController::class, 'updateUser']);
        Route::post('/users/{user}/reset-data', [AdminController::class, 'resetData']);
        Route::post('/users/{user}/reset-password', [AdminController::class, 'resetPassword']);
        Route::delete('/users/{user}', [AdminController::class, 'destroyUser']);

        Route::get('/news', [NewsController::class, 'adminIndex']);
        Route::post('/news/generate-draft', [NewsController::class, 'generateDraft']);
        Route::post('/news', [NewsController::class, 'store']);
        Route::patch('/news/{news}', [NewsController::class, 'update']);
        Route::delete('/news/{news}', [NewsController::class, 'destroy']);
    });
});
