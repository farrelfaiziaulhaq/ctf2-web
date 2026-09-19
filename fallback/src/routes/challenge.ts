import { spawn } from "bun";
import type { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../app-env";
import { currentUser, issueSession, requireElevatedAdmin, requireUser } from "../auth";
import { createIncident, findUserByUsername, listReportProfiles, listUserIncidents } from "../db";
import { assert, canonicalOrigin, sanitizeIncidentHtml } from "../lib";
import { assertIncidentQueueAllowed, parseIncidentQueueFromRequest } from "../incidents";
import { buildLoginOptions, buildRegistrationOptions, verifyLoginResponse, verifyRegistrationResponse } from "../passkeys";
import { buildRenderedReport, importReportProfile } from "../reports";
import { renderView } from "../view";
import type { User } from "../db";

type ChallengeRouteOptions = {
  botToken: string;
};

function requireFormEncoded(contentType: string | undefined) {
  if (!contentType?.includes("application/x-www-form-urlencoded")) {
    return { error: "Use form encoding for incident submissions.", status: 415 } as const;
  }
  return null;
}

function incidentQueueError(error: unknown) {
  const message = error instanceof Error ? error.message : "invalid incident queue";
  return {
    error: message,
    status: message === "queue restricted" ? 403 : 400
  };
}

function passkeyAuthError() {
  return { error: "Passkey authentication failed.", status: 401 } as const;
}

function parseIncidentSubmission(user: User, raw: string) {
  const { params, validatedQueue, persistedQueue } = parseIncidentQueueFromRequest(raw);
  assertIncidentQueueAllowed(user, validatedQueue);
  const title = String(params.get("title") || "").trim();
  const body = String(params.get("body") || "");
  assert(title.length > 0, "title required");
  return {
    title,
    queue: persistedQueue,
    bodyHtml: sanitizeIncidentHtml(body)
  };
}

function parseIncidentId(body: FormData) {
  const incidentId = String(body.get("incidentId") || "").trim();
  assert(incidentId.length > 0, "incident id required");
  return incidentId;
}

export function registerChallengeRoutes(app: Hono<AppEnv>, options: ChallengeRouteOptions) {
  app.post("/api/incidents", async (c) => {
    const user = requireUser(c);
    const formEncodingError = requireFormEncoded(c.req.header("Content-Type") || "");
    if (formEncodingError) {
      return c.json({ error: formEncodingError.error }, formEncodingError.status);
    }

    try {
      const parsed = parseIncidentSubmission(user, await c.req.raw.text());
      const incidentId = createIncident(user.id, parsed.title, parsed.queue, parsed.bodyHtml);
      return c.json({ ok: true, incidentId, queue: parsed.queue });
    } catch (error) {
      const queueError = incidentQueueError(error);
      return c.json({ error: queueError.error }, queueError.status);
    }
  });

  app.get("/bot/review", (c) => {
    const user = requireUser(c);
    return c.html(renderView("bot-review", {
      currentUser: user,
      incidents: listUserIncidents(user.id),
      submittedIncidentId: String(c.req.query("submitted") || "")
    }));
  });

  app.post("/bot/visit", async (c) => {
    requireUser(c);
    const incidentId = parseIncidentId(await c.req.formData());
    spawn({
      cmd: ["bun", "run", "src/bot.ts", incidentId],
      cwd: process.cwd(),
      env: {
        ...process.env,
        APP_ORIGIN: canonicalOrigin(c.req.raw),
        BOT_TOKEN: options.botToken
      },
      stdout: "inherit",
      stderr: "inherit"
    });
    return c.redirect(`/bot/review?submitted=${encodeURIComponent(incidentId)}`);
  });

  app.post("/internal/bot/session", (c) => {
    const supplied = c.req.header("X-Bot-Token") || "";
    if (supplied !== options.botToken) {
      throw new HTTPException(403, { message: "Forbidden" });
    }
    const admin = findUserByUsername("admin");
    assert(admin && admin.role === "admin", "admin account missing");
    const sessionId = issueSession(c, admin.id, "review");
    return c.json({ ok: true, sessionId });
  });

  app.get("/api/passkeys/register/options", (c) => {
    const user = requireUser(c);
    return c.json(buildRegistrationOptions(user, canonicalOrigin(c.req.raw)));
  });

  app.post("/api/passkeys/register/verify", async (c) => {
    const user = requireUser(c);
    const body = await c.req.json();
    return c.json(verifyRegistrationResponse(user, body, canonicalOrigin(c.req.raw)));
  });

  app.get("/api/passkeys/login/options", (c) => {
    try {
      return c.json(buildLoginOptions(String(c.req.query("username") || ""), canonicalOrigin(c.req.raw)));
    } catch {
      const authError = passkeyAuthError();
      return c.json({ error: authError.error }, authError.status);
    }
  });

  app.post("/api/passkeys/login/verify", async (c) => {
    try {
      const body = await c.req.json();
      const result = verifyLoginResponse(body, canonicalOrigin(c.req.raw));
      issueSession(c, result.userId, "passkey");
      return c.json({ ok: true, username: result.username });
    } catch {
      const authError = passkeyAuthError();
      return c.json({ error: authError.error }, authError.status);
    }
  });

  app.post("/api/admin/report-profiles/import", async (c) => {
    const admin = requireElevatedAdmin(c);
    const body = await c.req.json();
    return c.json(importReportProfile(admin, body));
  });

  app.get("/admin/reports", (c) => {
    const admin = requireElevatedAdmin(c);
    return c.html(renderView("admin-reports", {
      currentUser: admin,
      reports: listReportProfiles(admin.id)
    }));
  });

  app.get("/admin/reports/:id/render", (c) => {
    requireElevatedAdmin(c);
    const rendered = buildRenderedReport(Number(c.req.param("id")));
    if (!rendered) {
      throw new HTTPException(404, { message: "Not found" });
    }
    return c.html(renderView("report", {
      currentUser: currentUser(c),
      ...rendered
    }));
  });
}
