import { db, nowIso } from "./runtime";
import type { Incident } from "./types";

export function listUserIncidents(userId: number) {
  return db.query("SELECT * FROM incidents WHERE author_id = ? ORDER BY id DESC").all(userId) as Incident[];
}

export function listAdminQueue() {
  return db.query("SELECT * FROM incidents WHERE queue = 'admin-review' ORDER BY id DESC").all() as Incident[];
}

export function findIncident(id: number) {
  return db.query("SELECT * FROM incidents WHERE id = ?").get(id) as Incident | null;
}

export function createIncident(authorId: number, title: string, queue: string, bodyHtml: string) {
  const result = db.prepare(`
    INSERT INTO incidents (author_id, title, queue, body_html, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(authorId, title, queue, bodyHtml, nowIso());
  return Number(result.lastInsertRowid);
}
