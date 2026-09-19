import { db, nowIso } from "./runtime";
import type { PasskeyRow } from "./types";

export function addPasskey(userId: number, credentialId: string, publicKeySpkiB64: string, transports: string[], signCount: number) {
  db.prepare(`
    INSERT INTO passkeys (user_id, credential_id, public_key_spki_b64, transports_json, sign_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, credentialId, publicKeySpkiB64, JSON.stringify(transports), signCount, nowIso());
}

export function listPasskeysForUser(userId: number) {
  return db.query("SELECT * FROM passkeys WHERE user_id = ? ORDER BY id ASC").all(userId) as PasskeyRow[];
}

export function findPasskeyByCredentialId(credentialId: string) {
  return db.query("SELECT * FROM passkeys WHERE credential_id = ?").get(credentialId) as PasskeyRow | null;
}

export function updatePasskeyCounter(id: number, signCount: number) {
  db.prepare("UPDATE passkeys SET sign_count = ? WHERE id = ?").run(signCount, id);
}
