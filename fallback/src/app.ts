import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "./app-env";
import { loadSession } from "./auth";
import { randomChallenge } from "./lib";
import { registerChallengeRoutes } from "./routes/challenge";
import { registerPageRoutes } from "./routes/pages";

export function createApp() {
  const app = new Hono<AppEnv>();
  const botToken = process.env.BOT_TOKEN || randomChallenge();

  app.use("*", loadSession);

  app.get("/static/*", serveStatic({
    root: "./",
    rewriteRequestPath: (path) => path.replace(/^\/static/, "/public")
  }));

  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      return c.text(error.message, error.status);
    }
    console.error(error);
    return c.text("Internal server error", 500);
  });

  app.notFound((c) => c.text("Not found", 404));

  app.get("/healthz", (c) => c.json({ ok: true }));

  registerPageRoutes(app);
  registerChallengeRoutes(app, { botToken });

  return app;
}
