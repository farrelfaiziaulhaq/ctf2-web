<?php

declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';
require __DIR__ . '/classes.php';

use PhpAmqpLib\Connection\AMQPStreamConnection;

$rabbitHost = getenv('RABBIT_HOST') ?: 'rabbitmq';
$rabbitUser = getenv('RABBIT_USER') ?: 'produser';
$rabbitPass = getenv('RABBIT_PASS') ?: 'Password123';
$queue = 'preview.render';

while (true) {
    try {
        $connection = new AMQPStreamConnection($rabbitHost, 5672, $rabbitUser, $rabbitPass);
        break;
    } catch (Throwable $e) {
        sleep(1);
    }
}

$channel = $connection->channel();
$channel->queue_declare($queue, false, true, false, false);

$channel->basic_consume($queue, '', false, false, false, false, function ($message) {
    try {
        $payload = @unserialize($message->body, ['allowed_classes' => true]);
        unset($payload);
        gc_collect_cycles();
    } catch (Throwable $e) {
    }
    $message->ack();
});

$channel->consume();
