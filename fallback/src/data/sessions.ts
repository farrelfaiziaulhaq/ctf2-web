import { db, nowIso, randomToken } from "./runtime";
import type { Session } from "./types";

export function createSession(userId: number, authLevel: Session["auth_level"] = "password") {
  const id = randomToken(24);
  db.prepare("INSERT INTO sessions (id, user_id, auth_level, created_at) VALUES (?, ?, ?, ?)").run(id, userId, authLevel, nowIso());
  return id;
}

export function getSession(id: string | null) {
  if (!id) {
    return null;
  }
  return db.query("SELECT * FROM sessions WHERE id = ?").get(id) as Session | null;
}

export function deleteSession(id: string) {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
}
