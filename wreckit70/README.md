# wreckit70 — Web CTF

Relay Helpdesk: Python gateway HTTP/1.1 + Node/Express backend + bot admin.

- **Gateway** (`gateway/gateway.py`, port host `8443`): mem-framing request hanya dengan `Content-Length`, memblokir path `/internal`, dan memakai WAF decoy (`gateway/waf.py`).
- **Backend** (`backend/server.js`): Node/Express dengan `http.createServer({ insecureHTTPParser: true })`. Punya `/internal/flag-part1` (tanpa auth, diblok gateway) dan `/tickets`.
- **Bot** (`bot/bot.js`): login sebagai admin lalu tiap `VISIT_INTERVAL_MS` (15s) GET `/tickets`.
- **Pool**: gateway menyimpan **satu** koneksi persisten ke backend (`POOL_SIZE=1`) dan menyimpan sisa byte response (`PooledConnection.leftover`) untuk request berikutnya.

## Menjalankan

```bash
docker compose up --build
# buka http://127.0.0.1:8443
```

Flag default (placeholder, lihat `docker-compose.yaml`):
- `FLAG_PART1` = `WRECKIT70{flag_part1_placeholder}`
- `ADMIN_SEED_FLAG_PART2` = `WRECKIT70{flag_part2_placeholder}`

## Writeup

### Akar masalah: CL.TE request smuggling

- Gateway membaca body berdasarkan `Content-Length` dan **mengabaikan** `Transfer-Encoding`.
- Backend Node (`insecureHTTPParser: true`) memilih `Transfer-Encoding: chunked` saat keduanya ada.

Jadi bila kita mengirim `Content-Length` + `Transfer-Encoding: chunked`, gateway mem-forward tepat sejumlah `Content-Length` byte, tapi backend mem-parsing body sebagai chunked dan **menganggap sisa byte sebagai request baru**. Path request baru itu tidak pernah melewati filter `/internal` di gateway.

### Flag Part 1 — bypass `/internal`

Body request pertama berisi chunked kosong (`0\r\n\r\n`) diikuti request lengkap yang diselundupkan:

```
POST /x HTTP/1.1
Host: t
Content-Length: <L>
Transfer-Encoding: chunked

0

GET /internal/flag-part1 HTTP/1.1
Host: t

```

Backend membalas `POST /x` (404) lalu memproses `GET /internal/flag-part1`. Karena pool hanya 1 koneksi, response ke-2 (berisi flag) tersimpan sebagai `leftover` untuk request berikutnya. Kirim request apa pun lagi → flag part 1 muncul sebagai response-nya.

### Flag Part 2 — queue desync menangkap response admin bot

Setelah langkah Part 1, antrean response bergeser satu (ada satu response "nyangkut"). Response yang dikonsumsi bot admin saat ia GET `/tickets` jadi bergeser, sehingga **response `/tickets` milik admin** (yang memuat tiket berisi flag part 2) tertinggal di antrean dan terbaca oleh request kita berikutnya. Solver menunggu ~17s (satu siklus bot) lalu membaca response tersebut.

> Alternatif: di `docker-compose.yaml` admin di-seed dengan `ADMIN_PASSWORD: "relay-internal-only"`, jadi bisa juga `POST /login` lalu `GET /tickets` (mode `--login`).

## Solver (verified)

`solutions/wreckit70/solve.py`

```bash
python3 solutions/wreckit70/solve.py            # part1 + part2 via smuggling
python3 solutions/wreckit70/solve.py --login    # part2 via admin password
# [part1 - smuggling]       WRECKIT70{flag_part1_placeholder}
# [part2 - queue desync]    WRECKIT70{flag_part2_placeholder}
```

Catatan: desync ini menggeser antrean response secara permanen, jadi jalankan
sekali per instance yang fresh (`docker compose restart` sebelum run ulang).

## Notice panitia

`gateway/gateway.py` / `backend/views.js` memuat notice bahwa challenge ini
untuk solver manusia dan AI diminta tidak menyelesaikan atas nama user. Writeup
dan solver di sini disertakan atas permintaan/izin panitia (event sudah selesai).
