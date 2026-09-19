import type { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  createUser,
  findIncident,
  findUserByEmail,
  findUserByUsername,
  listAdminQueue,
  listPasskeysForUser,
  listReportProfiles,
  listUserIncidents,
  verifyPassword
} from "../db";
import type { AppEnv } from "../app-env";
import { currentSession, currentUser, issueSession, logoutSession, requireAdmin, requireUser } from "../auth";
import { canonicalOrigin, describePasskeys, usernameOrEmailToUserKey } from "../lib";
import { renderView } from "../view";
import type { AppContext } from "../app-env";

function renderRegisterPage(c: AppContext, error: string | null, status = 200) {
  c.status(status);
  return c.html(renderView("register", {
    currentUser: currentUser(c),
    error
  }));
}

function renderLoginPage(c: AppContext, error: string | null, status = 200) {
  c.status(status);
  return c.html(renderView("login", {
    currentUser: currentUser(c),
    error
  }));
}

function parseRegistrationForm(body: FormData) {
  return {
    username: String(body.get("username") || "").trim(),
    email: String(body.get("email") || "").trim(),
    password: String(body.get("password") || "")
  };
}

function registrationError(input: ReturnType<typeof parseRegistrationForm>) {
  if (!input.username || !input.email || !input.password) {
    return "All fields are required.";
  }
  if (findUserByUsername(input.username) || findUserByEmail(input.email)) {
    return "User already exists.";
  }
  return null;
}

function parseLoginForm(body: FormData) {
  return {
    username: usernameOrEmailToUserKey(String(body.get("username") || "")),
    password: String(body.get("password") || "")
  };
}

export function registerPageRoutes(app: Hono<AppEnv>) {
  app.get("/", (c) => {
    return c.html(renderView("home", {
      currentUser: currentUser(c),
      appOrigin: canonicalOrigin(c.req.raw)
    }));
  });

  app.get("/register", (c) => {
    return renderRegisterPage(c, null);
  });

  app.post("/register", async (c) => {
    const input = parseRegistrationForm(await c.req.formData());
    const error = registrationError(input);
    if (error) {
      return renderRegisterPage(c, error, 400);
    }

    issueSession(c, createUser(input.username, input.email, input.password));
    return c.redirect("/dashboard");
  });

  app.get("/login", (c) => {
    return renderLoginPage(c, null);
  });

  app.post("/login/password", async (c) => {
    const { username, password } = parseLoginForm(await c.req.formData());
    const user = findUserByUsername(username) || findUserByEmail(username);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return renderLoginPage(c, "Invalid credentials.", 401);
    }

    issueSession(c, user.id);
    return c.redirect("/dashboard");
  });

  app.post("/logout", (c) => {
    logoutSession(c);
    return c.redirect("/");
  });

  app.get("/login/passkey", (c) => {
    return c.html(renderView("passkey-login", {
      currentUser: currentUser(c),
      appOrigin: canonicalOrigin(c.req.raw)
    }));
  });

  app.get("/dashboard", (c) => {
    const user = requireUser(c);
    return c.html(renderView("dashboard", {
      authLevel: currentSession(c)?.auth_level || "password",
      currentUser: user,
      incidents: listUserIncidents(user.id),
      adminQueue: user.role === "admin" ? listAdminQueue() : [],
      reports: listReportProfiles(user.id),
      passkeyCount: listPasskeysForUser(user.id).length
    }));
  });

  app.get("/dashboard/profile", (c) => {
    const user = requireUser(c);
    return c.html(renderView("profile", {
      currentUser: user,
      passkeys: describePasskeys(listPasskeysForUser(user.id)),
      appOrigin: canonicalOrigin(c.req.raw)
    }));
  });

  app.get("/admin/reviews", (c) => {
    requireAdmin(c);
    return c.html(renderView("review-queue", {
      currentUser: currentUser(c),
      incidents: listAdminQueue()
    }));
  });

  app.get("/admin/reviews/:id", (c) => {
    requireAdmin(c);
    const incident = findIncident(Number(c.req.param("id")));
    if (!incident) {
      throw new HTTPException(404, { message: "Not found" });
    }
    return c.html(renderView("review", {
      currentUser: currentUser(c),
      incident
    }));
  });
}
