FROM php:8.3-cli

RUN apt-get update && apt-get install -y --no-install-recommends git unzip ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
RUN docker-php-ext-install sockets

WORKDIR /worker
COPY worker-php/composer.json ./composer.json
RUN composer install --no-dev --no-interaction --prefer-dist
COPY worker-php/ ./

CMD ["sh", "-lc", "printf '%s\\n' 'PLAYIT{fake}' > /flag.txt && php worker.php"]
