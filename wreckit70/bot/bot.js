"use strict";
const http = require("http");

const APP_URL = process.env.APP_URL || "http://gateway:8443";
const VISIT_INTERVAL_MS = Number(process.env.VISIT_INTERVAL_MS || 15000);
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "relay-internal-only";

let sessionCookie = null;

function request(urlStr, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const hdrs = Object.assign({}, opts.headers || {});
    if (opts.body && !hdrs["Content-Length"]) {
      hdrs["Content-Length"] = Buffer.byteLength(opts.body).toString();
    }
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: opts.method || "GET",
        headers: hdrs,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body })
        );
      }
    );
    req.on("error", reject);
    req.end(opts.body || undefined);
  });
}

async function login() {
  while (true) {
    try {
      const res = await request(`${APP_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `username=admin&password=${encodeURIComponent(ADMIN_PASS)}`,
      });
      const raw = res.headers["set-cookie"];
      if (raw) {
        sessionCookie = (Array.isArray(raw) ? raw[0] : raw).split(";")[0];
        console.log("[bot] login successful");
        return;
      }
      throw new Error("no set-cookie in response");
    } catch (err) {
      console.error("[bot] login failed, retrying in 5s:", err.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

async function visitTickets() {
  try {
    await request(`${APP_URL}/tickets`, {
      headers: { Cookie: sessionCookie },
    });
  } catch (err) {
    console.error("[bot] visit error:", err.message);
  }
}

async function main() {
  console.log("[bot] logging in as admin...");
  await login();
  console.log(`[bot] visiting /tickets every ${VISIT_INTERVAL_MS}ms`);
  while (true) {
    await visitTickets();
    await new Promise((r) => setTimeout(r, VISIT_INTERVAL_MS));
  }
}

main();
