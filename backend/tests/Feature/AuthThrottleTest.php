<?php

it('throttles repeated login attempts for the same account', function () {
    foreach (range(1, 10) as $attempt) {
        $this->postJson('/api/auth/login', ['login' => 'Admin', 'password' => 'wrong'])
            ->assertStatus(422);
    }

    $this->postJson('/api/auth/login', ['login' => 'admin', 'password' => 'wrong'])
        ->assertStatus(429);
});

it('does not throttle other accounts when one account is locked', function () {
    foreach (range(1, 11) as $attempt) {
        $this->postJson('/api/auth/login', ['login' => 'victim', 'password' => 'wrong']);
    }

    $this->postJson('/api/auth/login', ['login' => 'someone-else', 'password' => 'wrong'])
        ->assertStatus(422);
});

it('caps total auth requests with a global bucket', function () {
    foreach (range(1, 120) as $attempt) {
        $this->postJson('/api/auth/login', ['login' => "user{$attempt}", 'password' => 'wrong']);
    }

    $this->postJson('/api/auth/login', ['login' => 'user-final', 'password' => 'wrong'])
        ->assertStatus(429);
});

it('throttles registration by email', function () {
    foreach (range(1, 10) as $attempt) {
        $this->postJson('/api/auth/register', ['email' => 'spam@cycleline.test'])
            ->assertStatus(422);
    }

    $this->postJson('/api/auth/register', ['email' => 'spam@cycleline.test'])
        ->assertStatus(429);
});
