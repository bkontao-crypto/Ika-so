import test from "node:test";
import assert from "node:assert/strict";
import { createUserCenter } from "../server/services/user-center.js";

function setup() {
  const calls = [];
  const db = { query: async (sql, args = []) => { calls.push({ sql, args }); return /count\(\*\)::int as n/.test(sql) ? [{ n: 0 }] : []; } };
  const accounts = { requireStaff: async () => ({}), audit: async () => {} };
  return { calls, uc: createUserCenter({ db, config: {} }, accounts) };
}

test("annuaire : la recherche passe en paramètre (jamais dans le SQL) et le tri est une liste blanche", async () => {
  const { calls, uc } = setup();
  await uc.directory("a", { q: "x'; drop table ika_users;--", sort: "1; drop table x", dir: "asc;--", segment: "active" });
  const list = calls.find((c) => /limit/.test(c.sql));
  assert.ok(!list.sql.includes("drop table"));
  assert.ok(list.args.includes("x'; drop table ika_users;--".toLowerCase().slice(0, 80)));
  assert.match(list.sql, /order by created_at desc/);
});

test("annuaire : filtres de dates bornés, pagination plafonnée", async () => {
  const { calls, uc } = setup();
  const r = await uc.directory("a", { from: "2026-01-01", to: "bad", dateField: "login", pageSize: 5000, page: -3 });
  assert.equal(r.pageSize, 100);
  assert.equal(r.page, 1);
  const list = calls.find((c) => /limit/.test(c.sql));
  assert.match(list.sql, /last_login_at >= \$1::date/);
  assert.ok(!/< \(\$\d::date \+ 1\)/.test(list.sql), "date invalide ignorée");
});

test("export CSV : neutralise les formules et trace l'export", async () => {
  const calls = [];
  const db = { query: async () => [{ user_id: "u1", email: "a@b.ml", full_name: "=cmd()", staff_role: "USER", account_status: "ACTIVE", segment: "active", advertiser: "none", listings: 0, logins_30d: 0 }] };
  const accounts = { requireStaff: async () => ({}), audit: async (...a) => calls.push(a) };
  const csv = await createUserCenter({ db, config: {} }, accounts).exportCsv("a", {});
  assert.ok(csv.includes(`"'=cmd()"`));
  assert.equal(calls[0][1], "OWNER_USERS_EXPORT");
});

test("analyse : compte inconnu → 404", async () => {
  const db = { query: async () => [] };
  await assert.rejects(createUserCenter({ db, config: {} }, { requireStaff: async () => ({}) }).analysis("a", "zz"), /introuvable/i);
});
