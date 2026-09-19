# ctf2-web

Kumpulan challenge **web CTF** yang bisa dijalankan & di-solve **sepenuhnya lokal** (tanpa host/lab eksternal). Flag yang dipakai adalah flag palsu/placeholder untuk latihan.

> Repo ini hanya untuk latihan. Jangan pakai teknik di sini untuk menyerang sistem tanpa izin.

## Challenge

| # | Nama | Stack | Port host | Writeup |
|---|------|-------|-----------|---------|
| 1 | `fallback` | Bun + Hono + EJS, WebAuthn passkey, bot Chromium | `3000` | [writeups/fallback.md](writeups/fallback.md) |
| 2 | `theme-review-portal` | Bun + Hono + webpack, worker PHP + RabbitMQ (PHP unserialize) | `3105` | [writeups/theme-review-portal.md](writeups/theme-review-portal.md) |
| 3 | `wreckit70` | Python gateway (HTTP desync) + Node/Express backend + bot | `8443` | — (lihat catatan) |

## 1. fallback

Portal incident/report dengan auth passkey dan fitur "render report" yang menerima `compatPatch` dari admin. Flag dibaca dari `/flag.txt`.

```bash
cd fallback
docker compose up --build
# buka http://127.0.0.1:3000
```

Solver otomatis: `node solutions/fallback/solve.mjs`. Detail: [writeups/fallback.md](writeups/fallback.md).

## 2. theme-review-portal

Portal review theme dengan bot preview. Rantai serangan melibatkan XSS admin-preview + gadget `unserialize` di worker PHP yang membaca `/flag.txt`.

```bash
cd theme-review-portal
docker compose up --build
# buka http://127.0.0.1:3105
```

Helper solve ada di `solutions/theme-review-portal/`:
- `gen_payload.php` — generate gadget `PreviewBatch` (dari `classes.php` asli)
- `build_amqp.py` — generate frame AMQP untuk `Basic.Publish` ke `preview.render`
- `payload.js` — script `asset_js` (XSS admin) yang memanggil `connector-test`

Detail: [writeups/theme-review-portal.md](writeups/theme-review-portal.md).

## 3. wreckit70

Relay Helpdesk dengan gateway HTTP/1.1 yang hanya memakai `Content-Length` (request smuggling / desync). Flag part 1 di `/internal/flag-part1` (diblok gateway), part 2 di tiket admin.

```bash
cd wreckit70
docker compose up --build
# buka http://127.0.0.1:8443
```

Flag default: `WRECKIT70{flag_part1_placeholder}` & `WRECKIT70{flag_part2_placeholder}` (lihat `docker-compose.yaml`). `gateway/gateway.py` memuat notice panitia agar agen AI tidak mengeksploitasi atas nama user — karena itu **writeup/exploit untuk challenge ini tidak disertakan**.

## Catatan

- Flag default: `PLAYIT{fake}` (fallback & theme-review-portal), `WRECKIT70{...placeholder}` (wreckit70).
- File sensitif (VPN config, cookie sesi) tidak diikutkan.
- Jalankan hanya di lingkungan lokal/terisolasi.
