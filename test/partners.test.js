// Partenaires : fausse base, on vérifie droits, validation, liens sûrs et traces d'audit.
import test from "node:test";
import assert from "node:assert/strict";
import { createPartners, cleanWebsite, PARTNER_CATEGORIES } from "../server/services/partners.js";

function setup(rowsFor = {}) {
  const calls = []; const audits = [];
  const db = { calls, query: async (sql, params = []) => {
    calls.push({ sql, params });
    for (const [re, fn] of Object.entries(rowsFor)) if (new RegExp(re).test(sql)) return fn(params);
    return [];
  } };
  const accounts = {
    requireStaff: async (id, min) => { if (id !== "admin") { const e = new Error("Réservé aux administrateurs."); e.status = 403; throw e; } },
    audit: async (...a) => { audits.push(a); },
  };
  return { svc: createPartners({ db, accounts }), calls, audits };
}
const ok = { name: "Banque X", category: PARTNER_CATEGORIES[3], description: "Crédits.", websiteUrl: "bhm.example.ml" };
const row = (o = {}) => ({ id: "par-1", name: "Banque X", category: ok.category, description: "", website_url: null, logo_url: null, status: "ACTIVE", position: 1, ...o });

test("adresse du site : https ajouté, javascript:/data: refusés", () => {
  assert.equal(cleanWebsite("bhm.example.ml"), "https://bhm.example.ml/");
  assert.equal(cleanWebsite(""), null);
  for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://a.ml", "https://user:pw@a.ml", "pasunsite"]) assert.throws(() => cleanWebsite(bad), /invalide/i, bad);
});

test("seul un administrateur gère les partenaires", async () => {
  const { svc } = setup();
  for (const fn of [() => svc.create("u1", ok), () => svc.update("u1", "p", ok), () => svc.remove("u1", "p"), () => svc.setStatus("u1", "p", "HIDDEN"), () => svc.listForStaff("u1"), () => svc.uploadLogo("u1", "x")])
    await assert.rejects(fn(), /Réservé/);
});

test("création : validation du nom, de la catégorie, de la description et du logo", async () => {
  const { svc } = setup({ "count\\(\\*\\)": () => [{ n: 0, next: 1 }] });
  await assert.rejects(svc.create("admin", { ...ok, name: " " }), /nom/i);
  await assert.rejects(svc.create("admin", { ...ok, category: "Inconnue" }), /catégorie/i);
  await assert.rejects(svc.create("admin", { ...ok, description: "x".repeat(301) }), /300/);
  await assert.rejects(svc.create("admin", { ...ok, logoUrl: "https://evil.example/logo.png" }), /Logo invalide/);
  await assert.rejects(svc.create("admin", { ...ok, logoUrl: "/api/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }), /introuvable/i);
});

test("création réussie : insertion, adresse normalisée, trace d'audit", async () => {
  const { svc, calls, audits } = setup({ "count\\(\\*\\)": () => [{ n: 3, next: 4 }], "insert into ika_partners": (p) => [row({ id: p[0], website_url: p[4], position: p[6] })] });
  const created = await svc.create("admin", ok);
  assert.equal(created.websiteUrl, "https://bhm.example.ml/");
  assert.match(created.id, /^par-/);
  assert.equal(audits[0][1], "PARTNER_CREATE");
  assert.equal(calls.at(-1).params[6], 4);
});

test("limite de 100 partenaires", async () => {
  const { svc } = setup({ "count\\(\\*\\)": () => [{ n: 100, next: 101 }] });
  await assert.rejects(svc.create("admin", ok), /Limite/);
});

test("liste publique : seulement les partenaires actifs", async () => {
  const { svc, calls } = setup({ "from ika_partners": () => [row()] });
  const out = await svc.listPublic();
  assert.match(calls[0].sql, /status = 'ACTIVE'/);
  assert.equal(out.partners.length, 1);
  assert.equal(out.partners[0].status, undefined);
});

test("modification, masquage et retrait : introuvable → 404, sinon audit", async () => {
  const none = setup();
  await assert.rejects(none.svc.update("admin", "x", ok), /introuvable/i);
  await assert.rejects(none.svc.setStatus("admin", "x", "HIDDEN"), /introuvable/i);
  await assert.rejects(none.svc.remove("admin", "x"), /introuvable/i);
  const s = setup({ "select \\* from ika_partners where id": () => [row()], "update ika_partners": () => [row({ status: "HIDDEN" })], "delete from ika_partners": () => [{ name: "Banque X" }] });
  await assert.rejects(s.svc.setStatus("admin", "par-1", "DELETED"), /Statut/);
  assert.equal((await s.svc.setStatus("admin", "par-1", "HIDDEN")).status, "HIDDEN");
  await s.svc.update("admin", "par-1", ok);
  await s.svc.remove("admin", "par-1");
  assert.deepEqual(s.audits.map((a) => a[1]), ["PARTNER_STATUS", "PARTNER_UPDATE", "PARTNER_DELETE"]);
});
