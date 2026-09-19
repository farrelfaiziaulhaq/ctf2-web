import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes, scryptSync } from "node:crypto";

const dbPath = process.env.DB_PATH || "data/review-ops.sqlite";
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath, { create: true });
db.exec("PRAGMA journal_mode = WAL;");

export function ensureColumn(table: string, column: string, definition: string) {
  const columns = db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function randomToken(bytes: number) {
  return randomBytes(bytes).toString("hex");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${digest}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, digest] = stored.split(":");
  if (!salt || !digest) {
    return false;
  }
  const candidate = scryptSync(password, salt, 32).toString("hex");
  return digest === candidate;
}
