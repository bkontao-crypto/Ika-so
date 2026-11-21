import test from "node:test";
import assert from "node:assert/strict";

import { parseVideoLink } from "../server/lib/discover.js";
test("liens vidéo : seuls YouTube et Facebook en https sont acceptés, adresse nettoyée", () => {
  assert.equal(parseVideoLink("https://youtu.be/dQw4w9WgXcQ?si=abc").url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(parseVideoLink("https://www.facebook.com/watch/?v=1234567890123").provider, "facebook");
  for (const bad of ["http://youtu.be/dQw4w9WgXcQ", "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ", "https://user:pw@youtu.be/dQw4w9WgXcQ", "javascript:alert(1)", "https://evil.com/x", ""]) assert.equal(parseVideoLink(bad), null);
});

import { createDiscover } from "../server/services/discover.js";
function modSetup({ limit = 10, reporters = 3, status = "ACTIVE" } = {}) {
  const alerts = [], audit = [], updates = [];
  const db = { query: async (sql, args = []) => {
    if (/select id, user_id from ika_publications/.test(sql)) return [{ id: "p1", user_id: "author" }];
    if (/insert into ika_publication_reports/.test(sql)) return [{ id: "r" }];
    if (/count\(distinct r.reporter_id\)/.test(sql)) return [{ n: reporters }];
    if (/update ika_profiles set account_status = 'RESTRICTED'/.test(sql)) { updates.push(args); return status === "ACTIVE" ? [{ user_id: args[0] }] : []; }
    return [];
  } };
  const svc = createDiscover({ db, accounts: { requireActive: async () => ({ account_status: "ACTIVE" }) }, rules: { official: async () => ({ discoverAutoBlockReports: limit }) }, engagement: {},
    moderationAudit: { log: async (who, e) => audit.push({ who, ...e }) }, requestsHub: { notifyStaff: async (n) => alerts.push(n) } });
  return { svc, alerts, audit, updates };
}
test("signalement : alerte l'équipe, pas de blocage sous le seuil", async () => {
  const { svc, alerts, updates } = modSetup({ reporters: 9 });
  await svc.report("u2", "p1", REPORT_REASON());
  assert.equal(alerts.length, 1); assert.equal(alerts[0].kind, "DISCOVER_REPORT"); assert.equal(updates.length, 0);
});
test("signalement : au seuil (10 membres différents) le compte est restreint automatiquement et tracé", async () => {
  const { svc, alerts, updates, audit } = modSetup({ reporters: 10 });
  await svc.report("u2", "p1", REPORT_REASON());
  assert.equal(updates.length, 1); assert.match(updates[0][1], /10 membres/);
  assert.equal(alerts.at(-1).kind, "DISCOVER_AUTO_BLOCK"); assert.equal(audit[0].action, "DISCOVER_AUTO_BLOCK"); assert.equal(audit[0].details.automatic, true);
});
test("signalement : seuil à 0 = blocage automatique désactivé", async () => {
  const { svc, updates } = modSetup({ limit: 0, reporters: 50 });
  await svc.report("u2", "p1", REPORT_REASON());
  assert.equal(updates.length, 0);
});
import { REPORT_REASONS } from "../server/lib/discover.js";
function REPORT_REASON() { return REPORT_REASONS[0]; }
