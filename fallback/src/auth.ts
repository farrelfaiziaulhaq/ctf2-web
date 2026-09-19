import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import {
  createSession,
  deleteSession,
  findUserById,
  getSession,
  type Session,
  type User
} from "./db";
import type { AppContext } from "./app-env";

export function currentUser(c: AppContext) {
  return c.get("currentUser") as User | null;
}

export function currentSession(c: AppContext) {
  return c.get("currentSession") as Session | null;
}

export async function loadSession(c: AppContext, next: () => Promise<void>) {
  const sessionId = getCookie(c, "session") || null;
  const session = sessionId ? getSession(sessionId) : null;
  c.set("currentSession", session);
  c.set("currentUser", session ? findUserById(session.user_id) : null);
  await next();
}

export function requireUser(c: AppContext) {
  const user = currentUser(c);
  if (!user) {
    throw new HTTPException(401, { message: "Authentication required" });
  }
  return user;
}

export function requireAdmin(c: AppContext) {
  const user = requireUser(c);
  if (user.role !== "admin") {
    throw new HTTPException(403, { message: "Admin only" });
  }
  return user;
}

export function requireElevatedAdmin(c: AppContext) {
  const user = requireAdmin(c);
  const session = currentSession(c);
  if (!session || session.auth_level !== "passkey") {
    throw new HTTPException(403, { message: "Passkey reauthentication required" });
  }
  return user;
}

export function issueSession(c: AppContext, userId: number, authLevel: Session["auth_level"] = "password") {
  const sessionId = createSession(userId, authLevel);
  setCookie(c, "session", sessionId, { path: "/", httpOnly: true, sameSite: "Lax" });
  return sessionId;
}

export function logoutSession(c: AppContext) {
  const sessionId = getCookie(c, "session");
  if (sessionId) {
    deleteSession(sessionId);
  }
  deleteCookie(c, "session", { path: "/" });
}
