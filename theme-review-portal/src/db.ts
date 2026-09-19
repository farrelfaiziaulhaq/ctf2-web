import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Database } from "bun:sqlite";

type ThemeRecord = {
  publicId: string;
  ownerId: number;
  name: string;
  query: string;
  assetJs: string;
  callbackUrl: string;
};

const dbPath = process.env.DB_PATH || "./data/theme-review.sqlite";
mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath, { create: true });

db.run(`
  CREATE TABLE IF NOT EXISTS themes (
    public_id TEXT PRIMARY KEY,
    owner_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    query TEXT NOT NULL,
    asset_js TEXT NOT NULL,
    callback_url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const insertThemeStmt = db.prepare(`
  INSERT INTO themes (public_id, owner_id, name, query, asset_js, callback_url)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const themeByPublicIdStmt = db.prepare(`
  SELECT
    public_id AS publicId,
    owner_id AS ownerId,
    name,
    query,
    asset_js AS assetJs,
    callback_url AS callbackUrl
  FROM themes
  WHERE public_id = ?
`);

const themesByOwnerStmt = db.prepare(`
  SELECT
    public_id AS publicId,
    owner_id AS ownerId,
    name,
    query,
    asset_js AS assetJs,
    callback_url AS callbackUrl
  FROM themes
  WHERE owner_id = ?
  ORDER BY created_at DESC, public_id DESC
`);

export function insertTheme(theme: ThemeRecord) {
  insertThemeStmt.run(
    theme.publicId,
    theme.ownerId,
    theme.name,
    theme.query,
    theme.assetJs,
    theme.callbackUrl,
  );
}

export function getTheme(publicId: string) {
  return themeByPublicIdStmt.get(publicId) as ThemeRecord | null;
}

export function listThemesByOwner(ownerId: number) {
  return themesByOwnerStmt.all(ownerId) as ThemeRecord[];
}
