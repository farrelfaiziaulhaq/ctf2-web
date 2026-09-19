import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const themeId = process.argv[2];
if (!themeId) {
  console.error("usage: bun run src/bot.ts <themeId>");
  process.exit(1);
}

const origin = process.env.APP_ORIGIN || "http://127.0.0.1:3000";
const adminPassword = process.env.ADMIN_PASSWORD;
const candidates = [
  process.env.CHROMIUM_PATH,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
].filter(Boolean) as string[];
const executablePath = candidates.find((value) => existsSync(value));

if (!executablePath) {
  console.error("missing chromium");
  process.exit(1);
}

if (!adminPassword) {
  console.error("missing ADMIN_PASSWORD");
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"]
});

try {
  const page = await browser.newPage();
  await page.goto(`${origin}/login`, { waitUntil: "networkidle2" });
  await page.type('input[name="username"]', "admin");
  await page.type('input[name="password"]', adminPassword);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }),
    page.click('button[type="submit"]')
  ]);
  await page.goto(`${origin}/admin/reviews/${themeId}`, { waitUntil: "networkidle2" });
  await new Promise((resolve) => setTimeout(resolve, 12000));
} finally {
  await browser.close();
}
