import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const incidentId = process.argv[2];
if (!incidentId) {
  console.error("usage: bun run src/bot.ts <incidentId>");
  process.exit(1);
}

const origin = process.env.APP_ORIGIN || "http://127.0.0.1:3000";
const botToken = process.env.BOT_TOKEN || "";
const candidates = [
  process.env.CHROMIUM_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean) as string[];

const executablePath = candidates.find((candidate) => existsSync(candidate));

if (!executablePath) {
  console.error("No Chromium/Chrome executable found for the bot");
  process.exit(1);
}

if (!botToken) {
  console.error("BOT_TOKEN is required for bot session bootstrap");
  process.exit(1);
}

const sessionResponse = await fetch(`${origin}/internal/bot/session`, {
  method: "POST",
  headers: {
    "X-Bot-Token": botToken,
  },
});

if (!sessionResponse.ok) {
  console.error(`Failed to bootstrap bot session: ${sessionResponse.status}`);
  process.exit(1);
}

const sessionPayload = (await sessionResponse.json()) as { sessionId?: string };
const sessionId = sessionPayload.sessionId;
if (!sessionId) {
  console.error("Bot session bootstrap did not return a session ID");
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--ignore-certificate-errors",
  ],
});

try {
  const page = await browser.newPage();
  await page.setCookie({
    name: "session",
    value: sessionId,
    url: origin,
    httpOnly: true,
  });
  await page.goto(`${origin}/admin/reviews/${encodeURIComponent(incidentId)}`, {
    waitUntil: "networkidle2",
  });
  await new Promise((resolve) => setTimeout(resolve, 3500));
} finally {
  await browser.close();
}
