import { db, hashPassword } from "./runtime";
import type { User } from "./types";

export function findUserByUsername(username: string) {
  return db.query("SELECT * FROM users WHERE username = ?").get(username) as User | null;
}

export function findUserByEmail(email: string) {
  return db.query("SELECT * FROM users WHERE email = ?").get(email) as User | null;
}

export function findUserById(id: number) {
  return db.query("SELECT * FROM users WHERE id = ?").get(id) as User | null;
}

export function createUser(username: string, email: string, password: string) {
  const result = db.prepare(`
    INSERT INTO users (username, email, password_hash, role)
    VALUES (?, ?, ?, 'user')
  `).run(username, email, hashPassword(password));
  return Number(result.lastInsertRowid);
}
