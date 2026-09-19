import { db, nowIso } from "./runtime";
import type { ReportProfile } from "./types";

export function createReportProfile(ownerId: number, name: string, config: Record<string, unknown>, compatPatch: Record<string, unknown>) {
  const result = db.prepare(`
    INSERT INTO report_profiles (owner_id, name, config_json, compat_patch_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(ownerId, name, JSON.stringify(config), JSON.stringify(compatPatch), nowIso());
  return Number(result.lastInsertRowid);
}

export function listReportProfiles(ownerId: number) {
  return db.query("SELECT * FROM report_profiles WHERE owner_id = ? ORDER BY id DESC").all(ownerId) as ReportProfile[];
}

export function findReportProfile(id: number) {
  return db.query("SELECT * FROM report_profiles WHERE id = ?").get(id) as ReportProfile | null;
}
