// Audit A-01 : le CRM doit exposer stats() (route /me/crm/stats et /me/crm/insights, page crm-leads).
import test from "node:test";
import assert from "node:assert/strict";
import { createCrm } from "../server/services/crm.js";

test("crm.stats : total, répartition par statut, taux de conversion, évolution", async () => {
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (/group by status/.test(sql)) return [{ status: "NEW", n: 6 }, { status: "WON", n: 2 }, { status: "LOST", n: 2 }];
      return [{ week: "2026-11-09", count: 3 }, { week: "2026-11-16", count: 5 }];
    },
  };
  const s = await createCrm({ db }).stats("u1");
  assert.equal(s.total, 10);
  assert.deepEqual(s.byStatus, { NEW: 6, WON: 2, LOST: 2 });
  assert.equal(s.conversionRate, 20);
  assert.deepEqual(s.evolution, [{ week: "2026-11-09", count: 3 }, { week: "2026-11-16", count: 5 }]);
  assert.ok(calls.every((c) => c.params[0] === "u1"), "toujours limité à l'annonceur demandé");
});

test("crm.stats : aucun lead → zéros, pas de division par zéro", async () => {
  const s = await createCrm({ db: { query: async () => [] } }).stats("u1");
  assert.deepEqual(s, { total: 0, byStatus: {}, conversionRate: 0, evolution: [] });
});
