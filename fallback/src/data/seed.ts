import { db, hashPassword, randomToken } from "./runtime";
import { createReportProfile } from "./reports";
import { findUserByUsername } from "./users";

export function seedDb() {
  const count = db.query("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (count.count > 0) {
    return;
  }

  const adminPassword = process.env.ADMIN_PASSWORD || randomToken(24);
  const adminEmail = process.env.ADMIN_EMAIL || "admin@fallback.local";

  const insertUser = db.prepare(`
    INSERT INTO users (username, email, password_hash, role)
    VALUES (?, ?, ?, ?)
  `);

  insertUser.run("admin", adminEmail, hashPassword(adminPassword), "admin");

  const admin = findUserByUsername("admin");
  if (admin) {
    createReportProfile(admin.id, "Daily Ops", {
      title: "daily-ops",
      rows: ["Escalations", "Backlog", "Auth anomalies"],
      formatter: "table"
    }, {
      formatter: "table",
      footerText: "No inherited post-render hooks loaded."
    });
  }
}
