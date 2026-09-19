import { db, nowIso, randomToken } from "./runtime";
import type { ChallengeRow } from "./types";

export function createChallenge(userId: number, purpose: "register" | "login", challengeB64: string, usernameHint: string | null) {
  const id = randomToken(18);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO challenges (id, user_id, purpose, challenge_b64, username_hint, expires_at, used_at)
    VALUES (?, ?, ?, ?, ?, ?, NULL)
  `).run(id, userId, purpose, challengeB64, usernameHint, expiresAt);
  return id;
}

export function getChallenge(id: string) {
  return db.query("SELECT * FROM challenges WHERE id = ?").get(id) as ChallengeRow | null;
}

export function consumeChallenge(id: string) {
  db.prepare("UPDATE challenges SET used_at = ? WHERE id = ?").run(nowIso(), id);
}
