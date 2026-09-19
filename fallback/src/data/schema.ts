import { db, ensureColumn } from "./runtime";

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'admin'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      auth_level TEXT NOT NULL DEFAULT 'password' CHECK(auth_level IN ('password', 'review', 'passkey')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      queue TEXT NOT NULL,
      body_html TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS passkeys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      credential_id TEXT UNIQUE NOT NULL,
      public_key_spki_b64 TEXT NOT NULL,
      transports_json TEXT NOT NULL,
      sign_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      purpose TEXT NOT NULL CHECK(purpose IN ('register', 'login')),
      challenge_b64 TEXT NOT NULL,
      username_hint TEXT,
      expires_at TEXT NOT NULL,
      used_at TEXT
    );

    CREATE TABLE IF NOT EXISTS report_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      config_json TEXT NOT NULL,
      compat_patch_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  ensureColumn("sessions", "auth_level", "TEXT NOT NULL DEFAULT 'password'");
}
