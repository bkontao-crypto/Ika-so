// BUG-004 (partie 2) : requirePermission (accounts) et son premier branchement dans le service de confiance.
// Exigence : à rôle égal, requirePermission donne EXACTEMENT les mêmes accès que requireStaff (droits actuels inchangés).
// Fausse base de données : aucun accès réseau ni PostgreSQL.
import test from "node:test";
import assert from "node:assert/strict";
import { createAccounts } from "../server/services/accounts.js";
import { createTrust } from "../server/services/trust.js";
import { ALL_PERMISSIONS } from "../server/lib/permissions.js";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function fakeDb({ role = "USER", status = "ACTIVE", grants = [] } = {}) {
  const calls = [];
  const query = async (sql, params = []) => {
    calls.push({ sql, params });
    if (/select \* from ika_profiles/.test(sql)) return [{ user_id: params[0], staff_role: role, account_status: status }];
    if (/from ika_user_permissions/.test(sql)) return grants.map((permission_code) => ({ permission_code }));
    return [];
  };
  return { calls, query, transaction: async (fn) => fn({ query }) };
}
const accountsFor = (opts) => { const db = fakeDb(opts); return { db, acc: createAccounts({ db, config: {} }) }; };
const outcome = async (p) => { try { await p; return "ok"; } catch (e) { return `${e.status}:${e.message}`; } };

const ROLES = ["USER", "MODERATOR", "ADMIN", "SUPERADMIN"];
const STATUSES = ["ACTIVE", "RESTRICTED", "BANNED"];
// Les cinq contrôles migrés dans server/services/trust.js : permission nommée ↔ rang qu'elle remplace.
const MIGRATED = [
  ["trust.proof_review", "MODERATOR"],
  ["trust.agency_badge", "ADMIN"],
  ["trust.badge_remove", "ADMIN"],
  ["trust.blacklist", "ADMIN"],
  ["payments.manage", "ADMIN"], // lot 2 : server/services/payments.js
  ["analytics.read", "ADMIN"],  // lot 2 : server/services/stats.js
  ["moderation.review", "MODERATOR"],   // lot 3 : modération, avis, signalements, candidatures d'annonceurs
  ["moderation.review", undefined],     // lot 3 : requireStaff(userId) sans niveau = MODERATOR
  ["moderation.restrict", "MODERATOR"], // lot 3 : première garde de setAccountStatus
];

test("requirePermission : mêmes accès et mêmes messages que requireStaff, pour chaque rôle et chaque statut de compte", async () => {
  for (const [permission, minimum] of MIGRATED) {
    for (const role of ROLES) {
      for (const status of STATUSES) {
        const { acc } = accountsFor({ role, status });
        const before = await outcome(acc.requireStaff("u1", minimum));
        const after = await outcome(acc.requirePermission("u1", permission));
        assert.equal(after, before, `${permission} / ${role} / ${status}`);
      }
    }
  }
});

test("requirePermission : refus par défaut (permission inconnue, compte ordinaire, banni, restreint)", async () => {
  assert.match(await outcome(accountsFor({ role: "SUPERADMIN" }).acc.requirePermission("u1", "permission.inconnue")), /^403:/);
  assert.match(await outcome(accountsFor({ role: "USER" }).acc.requirePermission("u1", "trust.proof_review")), /^403:/);
  assert.equal(await outcome(accountsFor({ role: "ADMIN", status: "BANNED" }).acc.requirePermission("u1", "trust.blacklist")), "403:Compte bloqué.");
  assert.match(await outcome(accountsFor({ role: "ADMIN", status: "RESTRICTED" }).acc.requirePermission("u1", "trust.blacklist")), /restreint/);
  assert.equal(await outcome(accountsFor({ role: "ADMIN" }).acc.requirePermission("u1", "trust.blacklist")), "ok");
});

test("requirePermission : le message dépend du niveau (modération / administrateurs), comme avant", async () => {
  assert.equal(await outcome(accountsFor({ role: "USER" }).acc.requirePermission("u1", "trust.proof_review")), "403:Réservé à la modération.");
  assert.equal(await outcome(accountsFor({ role: "MODERATOR" }).acc.requirePermission("u1", "trust.blacklist")), "403:Réservé aux administrateurs.");
});

test("requirePermission : une permission accordée individuellement ouvre l'accès à un modérateur", async () => {
  const { acc } = accountsFor({ role: "MODERATOR", grants: ["trust.blacklist"] });
  assert.equal(await outcome(acc.requirePermission("u1", "trust.blacklist")), "ok");
  assert.match(await outcome(acc.requirePermission("u1", "trust.badge_remove")), /^403:/, "seule la permission accordée est ouverte");
});

test("requirePermission : une permission non délégable accordée par erreur n'ouvre rien", async () => {
  const { acc } = accountsFor({ role: "ADMIN", grants: ["staff.role_change", "permissions.grant"] });
  assert.match(await outcome(acc.requirePermission("u1", "staff.role_change")), /^403:/);
  assert.match(await outcome(acc.requirePermission("u1", "permissions.grant")), /^403:/);
});

test("requirePermission : une permission accordée ne contourne ni le blocage ni la restriction du compte", async () => {
  assert.equal(await outcome(accountsFor({ role: "MODERATOR", status: "BANNED", grants: ["trust.blacklist"] }).acc.requirePermission("u1", "trust.blacklist")), "403:Compte bloqué.");
  assert.match(await outcome(accountsFor({ role: "MODERATOR", status: "RESTRICTED", grants: ["trust.blacklist"] }).acc.requirePermission("u1", "trust.blacklist")), /restreint/);
});

test("requirePermission : un compte ordinaire n'obtient rien d'une ligne de permission, et la base n'est pas interrogée pour rien", async () => {
  const { acc, db } = accountsFor({ role: "USER", grants: ["trust.blacklist"] });
  assert.match(await outcome(acc.requirePermission("u1", "trust.blacklist")), /^403:/);
  assert.equal(db.calls.filter((c) => /ika_user_permissions/.test(c.sql)).length, 0);
  const admin = accountsFor({ role: "ADMIN" });
  await admin.acc.requirePermission("u1", "trust.blacklist");
  assert.equal(admin.db.calls.filter((c) => /ika_user_permissions/.test(c.sql)).length, 0, "droit déjà donné par le rôle : pas de requête");
});

test("requirePermission : les permissions expirées sont écartées par la requête", async () => {
  const { acc, db } = accountsFor({ role: "MODERATOR" });
  await outcome(acc.requirePermission("u1", "trust.blacklist"));
  const q = db.calls.find((c) => /ika_user_permissions/.test(c.sql));
  assert.match(q.sql, /expires_at is null or expires_at > now\(\)/);
  assert.deepEqual(q.params, ["u1"]);
});

// Une faute de frappe dans un code ferait refuser tout le monde sans bruit : tous les codes utilisés doivent exister.
test("requirePermission : tous les codes utilisés dans server/ existent dans la matrice", () => {
  const files = [];
  const walk = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith(".js")) files.push(p); } };
  walk(new URL("../server", import.meta.url).pathname);
  const used = new Map();
  for (const f of files) {
    if (f.endsWith("/services/accounts.js")) continue; // définition
    for (const call of readFileSync(f, "utf8").matchAll(/requirePermission\(([^)]*)\)/g)) {
      for (const [, code] of call[1].matchAll(/"([a-z_]+\.[a-z_]+)"/g)) used.set(code, f); // ignore les autres chaînes (ex. "AGENCE")
    }
  }
  assert.ok(used.size >= 6, "les codes migrés doivent être trouvés");
  for (const [code, file] of used) assert.ok(ALL_PERMISSIONS.includes(code), `code inconnu « ${code} » dans ${file}`);
});

// --- Branchement dans le service de confiance ---------------------------------------------------
test("confiance : chaque contrôle migré demande la bonne permission nommée", async () => {
  const asked = [];
  const stop = new Error("STOP");
  const accounts = {
    requireStaff: async () => {},
    requirePermission: async (_id, permission) => { asked.push(permission); throw stop; },
  };
  const db = { query: async (sql) => (/from ika_proofs p/.test(sql) ? [{ id: "p1", kind: "AGENCE", status: "PENDING" }] : []), transaction: async (fn) => fn({ query: async () => [] }) };
  const trust = createTrust({ db }, accounts);

  await assert.rejects(trust.revokeBadge("s1", { listingId: "l1", reason: "x" }), stop);
  await assert.rejects(trust.blacklistList("s1"), stop);
  await assert.rejects(trust.blacklistAdd("s1", { kind: "EMAIL", value: "a@b.c", reason: "x" }), stop);
  await assert.rejects(trust.blacklistRemove("s1", "b1"), stop);
  await assert.rejects(trust.decideProof("s1", "p1", { action: "APPROVE" }), stop);
  assert.deepEqual(asked, ["trust.badge_remove", "trust.blacklist", "trust.blacklist", "trust.blacklist", "trust.agency_badge"]);

  asked.length = 0;
  const dbDoc = { query: async (sql) => (/from ika_proofs p/.test(sql) ? [{ id: "p2", kind: "DOCUMENT", status: "PENDING" }] : []), transaction: async (fn) => fn({ query: async () => [] }) };
  await assert.rejects(createTrust({ db: dbDoc }, accounts).decideProof("s1", "p2", { action: "APPROVE" }), stop);
  assert.deepEqual(asked, ["trust.proof_review"], "un document simple reste au niveau modération");
});
