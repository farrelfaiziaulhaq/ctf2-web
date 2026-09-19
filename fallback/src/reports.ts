import { createReportProfile, findReportProfile, type User } from "./db";
import { buildRenderConfig, normalizeReportConfig, runPostRender, validateCompatPatch } from "./lib";

type ReportImportBody = Record<string, any>;

export function importReportProfile(admin: User, body: ReportImportBody) {
  const name = String(body.name || "Imported profile");
  const config = normalizeReportConfig(body.config);
  const compatPatch = typeof body.compatPatch === "object" && body.compatPatch ? body.compatPatch : {};
  validateCompatPatch(compatPatch);
  const reportId = createReportProfile(admin.id, name, config, compatPatch);
  return { ok: true, reportId };
}

export function buildRenderedReport(reportId: number) {
  const profile = findReportProfile(reportId);
  if (!profile) {
    return null;
  }

  const config = JSON.parse(profile.config_json) as Record<string, unknown>;
  const compatPatch = JSON.parse(profile.compat_patch_json) as Record<string, unknown>;
  const renderConfig = buildRenderConfig(config, compatPatch);
  const rows = Array.isArray(config.rows) ? config.rows.map(String) : ["Escalations", "Alerts"];
  const computedFooter = runPostRender(renderConfig, rows);

  return {
    profile,
    renderConfig,
    rows,
    computedFooter
  };
}
