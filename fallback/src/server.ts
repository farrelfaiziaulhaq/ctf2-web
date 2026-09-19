import { createApp } from "./app";
import { initDb, seedDb } from "./db";

initDb();
seedDb();

if (process.argv.includes("--seed-only")) {
  process.exit(0);
}
const app = createApp();

const port = Number(process.env.PORT || 3000);
const server = Bun.serve({
  port,
  hostname: "0.0.0.0",
  fetch: app.fetch,
  error(error) {
    console.error(error);
    return new Response("Internal server error", { status: 500 });
  }
});

console.log(`Fallback listening on ${server.url}`);
