import test from "node:test";
import assert from "node:assert/strict";
import { DELEGABLE_MODULES } from "../server/services/owner-delegations.js";

// DEC-003 (19 novembre 2026) : liste A conservée. Toute modification de cette liste est une décision de droits du propriétaire.
const DECIDEE = ["dashboard", "overview", "activity", "charts", "trends", "regions", "report", "report.pdf", "premium-funnel", "subscriptions", "monitoring", "health", "agencies", "crm", "pipeline", "visits", "complaints", "incidents", "marketing", "campaigns", "partners", "imports", "duplicates", "moderation", "reviews", "trust", "users", "payments"];

test("DEC-003 : les modules délégables sont exactement ceux décidés par le propriétaire", () => {
  assert.deepEqual([...DELEGABLE_MODULES].sort(), [...DECIDEE].sort());
});
test("DEC-003 : aucun module réservé au Superadmin n'est délégable", () => {
  for (const m of ["backup", "backups", "restores", "offers", "settings", "logo", "legal", "seo", "ai", "security-log", "countries", "delegations"]) assert.ok(!DELEGABLE_MODULES.has(m), m);
});
