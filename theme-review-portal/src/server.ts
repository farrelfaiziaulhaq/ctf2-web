import { spawn } from "bun";
import { randomBytes, randomUUID } from "node:crypto";
import { createConnection } from "node:net";
import { serveStatic } from "hono/bun";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Hono } from "hono";
import { getTheme, insertTheme, listThemesByOwner } from "./db";
import { renderTemplate } from "./views";

type User = {
  id: number;
  username: string;
  password: string;
  role: "user" | "admin";
};

type Session = {
  userId: number;
  csrfToken: string;
};

type AppVariables = {
  currentUser: User | null;
  session: Session | null;
};

type AdminAccess = {
  admin: User;
  session: Session;
};

type ThemeInput = {
  publicId: string;
  ownerId: number;
  name: string;
  query: string;
  assetJs: string;
  callbackUrl: string;
};

type ConnectorRequest = {
  host: string;
  port: number;
  segments: Buffer[];
};

const app = new Hono<{ Variables: AppVariables }>();
const adminPassword = process.env.ADMIN_PASSWORD || randomHex(18);
const users: User[] = [
  { id: 1, username: "admin", password: adminPassword, role: "admin" },
];
const sessions = new Map<string, Session>();
let nextUserId = 2;

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function randomHex(size: number) {
  return randomBytes(size).toString("hex");
}

function navHtml(user: User | null) {
  if (!user) {
    return [
      `<a class="button button-ghost" href="/login">Sign in</a>`,
      `<a class="button button-primary" href="/register">Create account</a>`,
    ].join(" ");
  }

  return [
    `<span class="nav-user">logged in as <b>${escapeHtml(user.username)}</b> (${user.role})</span>`,
    '<form method="post" action="/logout"><button class="button-ghost">Sign out</button></form>',
  ].join(" ");
}

function pageSubtitle(title: string) {
  const subtitles: Record<string, string> = {
    "Theme Review Portal": "Submit theme entries for internal review.",
    Register: "Create a player account to submit theme entries.",
    Login: "Return to your review queue.",
    Dashboard: "Create, inspect, and submit theme entries.",
  };

  return subtitles[title] || "Inspect the submitted review entry.";
}

function formErrorHtml(message: string) {
  return `<p class="form-alert" role="alert">${escapeHtml(message)}</p>`;
}

function noticeHtml(message: string) {
  return `<section class="notice" role="status" aria-live="polite"><p>${escapeHtml(message)}</p></section>`;
}

function renderPage(
  title: string,
  template: string,
  values: Record<string, string>,
  user: User | null,
) {
  return renderTemplate("layout.html", {
    title: escapeHtml(title),
    subtitle: escapeHtml(pageSubtitle(title)),
    nav: navHtml(user),
    body: renderTemplate(template, values),
  });
}

function renderLoginPage(user: User | null, values: Record<string, string> = {}) {
  return renderPage(
    "Login",
    "login.html",
    {
      error: values.error ? formErrorHtml(values.error) : "",
      username: escapeHtml(values.username || ""),
    },
    user,
  );
}

function renderRegisterPage(user: User | null, values: Record<string, string> = {}) {
  return renderPage(
    "Register",
    "register.html",
    {
      error: values.error ? formErrorHtml(values.error) : "",
      username: escapeHtml(values.username || ""),
    },
    user,
  );
}

function currentUser(c: any) {
  return c.get("currentUser") as User | null;
}

function currentSession(c: any) {
  return c.get("session") as Session | null;
}

function requireAdmin(c: any) {
  const user = currentUser(c);
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}

function parseCredentials(form: FormData) {
  return {
    username: String(form.get("username") || "").trim(),
    password: String(form.get("password") || ""),
  };
}

function readFormString(form: FormData, key: string) {
  return String(form.get(key) || "");
}

function startSession(c: any, userId: number) {
  const sid = randomHex(16);
  sessions.set(sid, { userId, csrfToken: randomHex(16) });
  setCookie(c, "session", sid, { path: "/", httpOnly: true, sameSite: "Lax" });
}

function createUser(username: string, password: string) {
  const user = {
    id: nextUserId++,
    username,
    password,
    role: "user" as const,
  };
  users.push(user);
  return user;
}

function canRegisterUser(username: string, password: string) {
  return (
    Boolean(username) &&
    Boolean(password) &&
    !users.some((user) => user.username === username)
  );
}

function findUser(username: string, password: string) {
  return users.find(
    (entry) => entry.username === username && entry.password === password,
  );
}

function findOwnedTheme(userId: number, publicId: string) {
  const theme = getTheme(publicId);
  if (!theme || theme.ownerId !== userId) {
    return null;
  }
  return theme;
}

function themeFromRequest(c: any) {
  return getTheme(c.req.param("id"));
}

function renderThemeItem(publicId: string, name: string, reportedId = "") {
  const escapedId = escapeHtml(publicId);
  const escapedName = escapeHtml(name);
  const status =
    reportedId === publicId
      ? `<p class="row-status">Submitted for review.</p>`
      : "";

  return [
    `<li class="theme-row"><div class="theme-main">`,
    `<span class="theme-title">${escapedName}</span>`,
    `<code class="theme-id">${escapedId}</code>`,
    `${status}</div>`,
    `<div class="row-actions">`,
    `<form method="post" action="/api/themes/${escapedId}/report">`,
    `<button class="button-primary">Submit for review</button></form>`,
    `<a class="button button-ghost" href="/themes/${escapedId}">Detail</a></div></li>`,
  ].join(" ");
}

function renderThemeDetailPage(
  user: User,
  publicId: string,
  query: string,
  callbackUrl: string,
  notice = "",
) {
  return renderPage(
    `Theme ${publicId}`,
    "theme_detail.html",
    {
      theme_id: escapeHtml(publicId),
      query: escapeHtml(query),
      callback: callbackUrl ? escapeHtml(callbackUrl) : "not configured",
      status: "Ready for review.",
      notice: notice ? noticeHtml(notice) : "",
    },
    user,
  );
}

function requireAdminAccess(c: any): AdminAccess | null {
  const admin = requireAdmin(c);
  const session = currentSession(c);
  if (!admin || !session) {
    return null;
  }
  return { admin, session };
}

function sessionFromId(sid: string | undefined) {
  return sid ? sessions.get(sid) || null : null;
}

function userFromSession(session: Session | null) {
  if (!session) {
    return null;
  }
  return users.find((entry) => entry.id === session.userId) || null;
}

function resolveRequestUser(sid: string | undefined) {
  const session = sessionFromId(sid);
  const user = userFromSession(session);
  return { session, user };
}

function renderAdminReviewPage(
  theme: { publicId: string; query: string; callbackUrl: string },
  session: Session,
  admin: User,
) {
  const nonce = randomHex(12);

  return {
    nonce,
    html: renderTemplate("admin_review.html", {
      theme_id: theme.publicId,
      theme_id_json: JSON.stringify(theme.publicId),
      csrf_token: escapeHtml(session.csrfToken),
      csrf_token_json: JSON.stringify(session.csrfToken),
      username: escapeHtml(admin.username),
      role: escapeHtml(admin.role),
      callback: theme.callbackUrl
        ? escapeHtml(theme.callbackUrl)
        : "not configured",
      nonce,
    }),
  };
}

function parseSegments(encoded: unknown) {
  if (!Array.isArray(encoded)) {
    return [];
  }
  return encoded.map((value: string) => Buffer.from(String(value), "base64"));
}

function createThemeInput(form: FormData, ownerId: number): ThemeInput {
  const publicId = randomUUID();
  const name = readFormString(form, "name").trim() || "theme review";
  const query = readFormString(form, "query").replaceAll("{{ID}}", publicId);
  const assetJs = readFormString(form, "asset_js") || readFormString(form, "chunk_js");
  const callbackUrl = readFormString(form, "callback_url").trim();
  return {
    publicId,
    ownerId,
    name,
    query,
    assetJs,
    callbackUrl,
  };
}

function parseConnectorRequest(body: any): ConnectorRequest {
  return {
    host: String(body.host || "rabbitmq"),
    port: Number(body.port || 5672),
    segments: parseSegments(body.segments_b64),
  };
}

function hasValidCsrf(body: any, session: Session) {
  return String(body.csrf || "") === session.csrfToken;
}

function validateConnectorRequest(c: any, body: any, access: AdminAccess) {
  if (!hasValidCsrf(body, access.session)) {
    return c.json({ error: "bad csrf" }, 403);
  }

  const request = parseConnectorRequest(body);
  if (!request.segments.length) {
    return c.json({ error: "missing segments" }, 400);
  }

  return request;
}

function spawnReviewBot(publicId: string) {
  spawn(["bun", "run", "src/bot.ts", publicId], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ADMIN_PASSWORD: adminPassword,
    },
    stdout: "ignore",
    stderr: "ignore",
  });
}

function applyReviewCsp(c: any, nonce: string) {
  c.header(
    "Content-Security-Policy",
    `script-src 'strict-dynamic' 'nonce-${nonce}'; default-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none';`,
  );
}

function redirectToStoredQuery(c: any, publicId: string, query: string) {
  const rawSearch = c.req.url.split("?")[1] || "";
  if (!rawSearch && query) {
    return c.redirect(`/admin/reviews/${publicId}?${query}`);
  }
  return null;
}

async function sendTcpSteps(host: string, port: number, steps: Buffer[]) {
  return await new Promise<string[]>((resolve, reject) => {
    const socket = createConnection({ host, port });
    const responses: string[] = [];
    let pending = Buffer.alloc(0);

    socket.on("data", (chunk) => {
      pending = Buffer.concat([pending, chunk]);
    });
    socket.on("error", reject);
    socket.on("connect", async () => {
      try {
        for (const step of steps) {
          socket.write(step);
          await new Promise((done) => setTimeout(done, 250));
          responses.push(pending.toString("base64"));
          pending = Buffer.alloc(0);
        }
        socket.end();
        resolve(responses);
      } catch (error) {
        reject(error);
      }
    });
  });
}

app.use("*", async (c, next) => {
  const sid = getCookie(c, "session");
  const { session, user } = resolveRequestUser(sid);
  c.set("session", session);
  c.set("currentUser", user);
  await next();
});

app.get(
  "/static/*",
  serveStatic({
    root: "./",
    rewriteRequestPath: (path) => path.replace(/^\/static/, "/public"),
  }),
);

app.get(
  "/vendor/*",
  serveStatic({
    root: "./node_modules",
    rewriteRequestPath: (path) => path.replace(/^\/vendor/, ""),
  }),
);

app.get("/", (c) => {
  if (currentUser(c)) {
    return c.redirect("/dashboard");
  }

  return c.html(renderPage("Theme Review Portal", "home.html", {}, null));
});

app.get("/register", (c) => c.html(renderRegisterPage(currentUser(c))));

app.post("/register", async (c) => {
  const { username, password } = parseCredentials(await c.req.formData());
  if (!canRegisterUser(username, password)) {
    return c.html(
      renderRegisterPage(currentUser(c), {
        error: "Choose a unique username and enter a password.",
        username,
      }),
      400,
    );
  }
  const user = createUser(username, password);
  startSession(c, user.id);

  return c.redirect("/dashboard");
});

app.get("/login", (c) => c.html(renderLoginPage(currentUser(c))));

app.post("/login", async (c) => {
  const { username, password } = parseCredentials(await c.req.formData());
  const user = findUser(username, password);

  if (!user) {
    return c.html(
      renderLoginPage(currentUser(c), {
        error: "Username or password is incorrect.",
        username,
      }),
      401,
    );
  }
  startSession(c, user.id);

  return c.redirect("/dashboard");
});

app.post("/logout", (c) => {
  const sid = getCookie(c, "session");
  if (sid) {
    sessions.delete(sid);
  }

  deleteCookie(c, "session", { path: "/" });
  return c.redirect("/");
});

app.get("/dashboard", (c) => {
  const user = currentUser(c);
  if (!user) {
    return c.redirect("/login");
  }

  const reportedId = c.req.query("reported") || "";
  const createdId = c.req.query("created") || "";
  const notice = reportedId
    ? "Theme entry submitted for review."
    : createdId
      ? "Theme entry created. Inspect the receipt or submit it when ready."
      : "";
  const own = listThemesByOwner(user.id)
    .map((theme) => renderThemeItem(theme.publicId, theme.name, reportedId))
    .join("");

  return c.html(
    renderPage(
      "Dashboard",
      "dashboard.html",
      {
        notice: notice ? noticeHtml(notice) : "",
        theme_items:
          own ||
          '<li class="empty-state">No entries yet. Create a theme entry to start the review queue.</li>',
      },
      user,
    ),
  );
});

app.post("/api/themes", async (c) => {
  const user = currentUser(c);
  if (!user) {
    return c.json({ error: "login required" }, 401);
  }
  const theme = createThemeInput(await c.req.formData(), user.id);
  insertTheme(theme);
  if (!c.req.header("content-type")?.includes("multipart/form-data")) {
    return c.redirect(`/themes/${theme.publicId}?created=1`);
  }
  return c.json({ ok: true, themeId: theme.publicId });
});

app.get("/themes/:id", (c) => {
  const user = currentUser(c);
  if (!user) {
    return c.redirect("/login");
  }

  const theme = findOwnedTheme(user.id, c.req.param("id"));
  if (!theme) {
    return c.text("not found", 404);
  }
  const notice = c.req.query("created")
    ? "Theme entry created. Review the details before submitting."
    : "";

  return c.html(
    renderThemeDetailPage(
      user,
      theme.publicId,
      theme.query,
      theme.callbackUrl,
      notice,
    ),
  );
});

app.post("/api/themes/:id/report", (c) => {
  const user = currentUser(c);
  const theme = user ? findOwnedTheme(user.id, c.req.param("id")) : null;

  if (!user || !theme) {
    return c.text("not found", 404);
  }

  spawnReviewBot(theme.publicId);

  return c.redirect(`/dashboard?reported=${encodeURIComponent(theme.publicId)}`);
});

app.get("/uploads/:id/assets/chunks/preview-runtime.js", (c) => {
  const theme = themeFromRequest(c);
  if (!theme) {
    return c.text("not found", 404);
  }

  c.header("Content-Type", "application/javascript");
  return c.body(theme.assetJs);
});

app.get("/admin/reviews/:id", (c) => {
  const access = requireAdminAccess(c);
  if (!access) {
    return c.text("admin only", 403);
  }

  const theme = themeFromRequest(c);
  if (!theme) {
    return c.text("not found", 404);
  }
  const redirect = redirectToStoredQuery(c, theme.publicId, theme.query);
  if (redirect) {
    return redirect;
  }
  const review = renderAdminReviewPage(theme, access.session, access.admin);
  applyReviewCsp(c, review.nonce);
  return c.html(review.html);
});

app.post("/api/reviews/:id/connector-test", async (c) => {
  const access = requireAdminAccess(c);
  if (!access) {
    return c.json({ error: "admin only" }, 403);
  }

  const theme = themeFromRequest(c);
  if (!theme) {
    return c.json({ error: "not found" }, 404);
  }
  const body = await c.req.json();
  const request = validateConnectorRequest(c, body, access);
  if (request instanceof Response) {
    return request;
  }

  const responses = await sendTcpSteps(
    request.host,
    request.port,
    request.segments,
  );
  return c.json({ ok: true, responses });
});

const port = Number(process.env.PORT || "3000");
console.log(`listening on ${port}`);

export default {
  port,
  fetch: app.fetch,
};
