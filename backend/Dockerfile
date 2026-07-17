# syntax=docker/dockerfile:1.7

FROM php:8.4-apache-bookworm AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libicu-dev \
        libonig-dev \
        libpq-dev \
        libzip-dev \
        unzip \
    && docker-php-ext-install -j"$(nproc)" \
        intl \
        mbstring \
        opcache \
        pdo_mysql \
        pdo_pgsql \
        zip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

WORKDIR /var/www/html

COPY backend/composer.json backend/composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-progress \
    --no-scripts \
    --no-autoloader \
    --prefer-dist

COPY backend/ ./

RUN composer dump-autoload --classmap-authoritative --no-dev \
    && php artisan package:discover --ansi \
    && mkdir -p \
        storage/app/private \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
    && chown -R www-data:www-data storage bootstrap/cache

FROM php:8.4-apache-bookworm AS runner

ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
ENV PORT=8080

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libicu72 \
        libonig5 \
        libpq5 \
        libzip4 \
    && a2enmod headers rewrite \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

COPY --from=builder /usr/local/lib/php/extensions/ /usr/local/lib/php/extensions/
COPY --from=builder /usr/local/etc/php/conf.d/ /usr/local/etc/php/conf.d/
COPY --from=builder --chown=www-data:www-data /var/www/html ./

COPY backend/docker/entrypoint.sh /usr/local/bin/cycleline-entrypoint
RUN chmod +x /usr/local/bin/cycleline-entrypoint

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD php -r "exit(@file_get_contents('http://127.0.0.1:' . (getenv('PORT') ?: '8080') . '/api/health') === false ? 1 : 0);"

ENTRYPOINT ["cycleline-entrypoint"]
CMD ["apache2-foreground"]
