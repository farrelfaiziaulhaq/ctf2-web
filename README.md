# ctf2-web

Kumpulan challenge **web CTF** yang bisa dijalankan & di-solve **sepenuhnya lokal** (tanpa host/lab eksternal). Flag yang dipakai adalah flag palsu (`PLAYIT{fake}`) untuk latihan.

> Repo ini hanya untuk latihan. Jangan pakai teknik di sini untuk menyerang sistem tanpa izin.

## Challenge

| # | Nama | Stack | Port host |
|---|------|-------|-----------|
| 1 | `fallback` | Bun + Hono + EJS, WebAuthn passkey, bot Chromium | `3000` |
| 2 | `theme-review-portal` | Bun + Hono + webpack, worker PHP + RabbitMQ (PHP unserialize) | `3105` |

## 1. fallback

Portal incident/report dengan auth passkey dan fitur "render report" yang menerima `compatPatch` dari admin. Flag dibaca dari `/flag.txt`.

```bash
cd fallback
docker compose up --build
# buka http://127.0.0.1:3000
```

## 2. theme-review-portal

Portal review theme dengan bot preview. Rantai serangan melibatkan XSS admin-preview + gadget `unserialize` di worker PHP yang membaca `/flag.txt`.

```bash
cd theme-review-portal
docker compose up --build
# buka http://127.0.0.1:3105
```

Helper solve ada di `solutions/theme-review-portal/` (`explout.php`, `gadget.php`, `payload.js`, `xss_pylaod.js`, `aqmp_builder.py`).

## Catatan

- Flag default: `PLAYIT{fake}` (dibuat saat build image, lihat `Dockerfile`).
- File sensitif (VPN config, cookie sesi) tidak diikutkan.
- Jalankan hanya di lingkungan lokal/terisolasi.
