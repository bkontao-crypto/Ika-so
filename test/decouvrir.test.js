// « Découvrir » : publications de la communauté. Réglages = conditions officielles du superadmin ; contact par la messagerie ; modération tracée.
import test from "node:test";
import assert from "node:assert/strict";
import { createDiscover } from "../server/services/discover.js";
import { createEngagement } from "../server/services/engagement.js";
import { containsPhone } from "../server/lib/discover.js";
import { normalizeRules, DEFAULT_RULES } from "../server/lib/account-rules.js";

const PNG = "data:image/png;base64," + Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString("base64");

function world({ rules = {}, postsToday = 0, role = "USER" } = {}) {
  const inserted = [], files = [], audit = [], sent = [];
  const q = async (sql, args = []) => {
    if (/insert into stored_files/.test(sql)) { files.push(args[0]); return []; }
    if (/select count\(\*\)::int as n from ika_publications/.test(sql)) return [{ n: postsToday }];
    if (/insert into ika_publications/.test(sql)) { inserted.push({ kind: args[3], category: args[4], zone: args[5], content: args[2] }); return []; }
    if (/insert into ika_publication_photos/.test(sql)) { inserted.push({ photo: args[2] }); return []; }
    if (/select id, user_id from ika_publications where id/.test(sql)) return args[0] === "p1" ? [{ id: "p1", user_id: "author" }] : [];
    if (/insert into ika_publication_reports/.test(sql)) { inserted.push({ report: args[3] }); return []; }
    if (/update ika_publications set status = 'HIDDEN'/.test(sql)) return args[0] === "p1" ? [{ user_id: "author" }] : [];
    if (/update ika_publications set status = 'PUBLISHED'/.test(sql)) return args[0] === "p1" ? [{ user_id: "author" }] : [];
    return [];
  };
  const db = { query: q, transaction: async (fn) => fn({ query: q }) };
  const accounts = {
    ensureProfile: async () => ({ account_status: "ACTIVE" }), assertCanPublish: () => {}, requireActive: async () => ({}),
    requireVerifiedPhone: async () => { throw new Error("PHONE"); },
    requireStaff: async (_u, min) => { const rank = { USER: 0, MODERATOR: 1, ADMIN: 2, SUPERADMIN: 3 }; if (rank[role] < rank[min]) throw new Error("Réservé"); },
  };
  const official = { ...DEFAULT_RULES, ...rules };
  const engagement = { sendToPublication: async (u, p, b) => { sent.push({ u, p, b }); return { threadId: "th1" }; } };
  const d = createDiscover({ db, accounts, rules: { official: async () => normalizeRules(official) }, engagement, moderationAudit: { log: async (who, e) => audit.push({ who, ...e }) } });
  return { d, inserted, files, audit, sent };
}

test("numéro de téléphone : bloqué sous toutes ses formes, sans bloquer les prix", () => {
  for (const s of ["Appelez le 76 00 00 00", "tel 76000000", "+223 76 00 00 00", "00223 66 12 34 56", "91-23-45-67", "76.12.34.56"]) assert.equal(containsPhone(s), true, s);
  for (const s of ["Terrain de 25 000 000 FCFA", "Budget 15000000 à Kati", "Prix 75 000 000 négociable", "Villa 4 pièces 3 chambres", "ACI 2000, 600 m2"]) assert.equal(containsPhone(s), false, s);
});

test("réglages Découvrir : valeurs par défaut sûres, bornes appliquées", () => {
  const r = normalizeRules(null);
  assert.deepEqual([r.discoverEnabled, r.discoverMaxPhotos, r.discoverPostsPerDay, r.discoverRequirePhone], [true, 4, 5, false]);
  const x = normalizeRules({ discoverMaxPhotos: 99, discoverPostsPerDay: 0, discoverEnabled: false });
  assert.deepEqual([x.discoverEnabled, x.discoverMaxPhotos, x.discoverPostsPerDay], [false, 4, 5]);
  assert.equal(normalizeRules({ discoverMaxPhotos: 0 }).discoverMaxPhotos, 0);
});

test("publier : texte, type, bien, quartier et photos enregistrés ; compte non annonceur accepté", async () => {
  const w = world();
  const r = await w.d.create("u1", { content: "Je cherche un terrain de 600 m2 à Kati, budget 20 000 000", kind: "RECHERCHE", category: "Terrain", zone: "Kati", photos: [PNG, PNG] });
  assert.match(r.id, /^pub_/);
  assert.deepEqual(w.inserted[0], { kind: "RECHERCHE", category: "Terrain", zone: "Kati", content: "Je cherche un terrain de 600 m2 à Kati, budget 20 000 000" });
  assert.equal(w.inserted.filter((x) => x.photo).length, 2);
  assert.match(w.inserted[1].photo, /^\/api\/media\/[0-9a-f-]{36}$/);
  assert.equal(w.files.length, 2);
});

test("publier : refus du texte trop court, du numéro de téléphone, des types inconnus et des photos non valides", async () => {
  const w = world();
  await assert.rejects(w.d.create("u1", { content: "ok" }), /trop court/);
  await assert.rejects(w.d.create("u1", { content: "Appelez-moi au 76 00 00 00 pour la maison" }), /numéro de téléphone/);
  await assert.rejects(w.d.create("u1", { content: "Une publication valable", kind: "PUB" }), /Type de publication/);
  await assert.rejects(w.d.create("u1", { content: "Une publication valable", category: "Château" }), /Type de bien/);
  await assert.rejects(w.d.create("u1", { content: "Une publication valable", photos: ["data:image/png;base64,AAAA"] }), /ne correspond pas|refusé|illisible/i);
  assert.equal(w.inserted.length, 0);
});

test("le superadmin décide : fermé, nombre de photos, plafond par jour, numéro confirmé exigé", async () => {
  await assert.rejects(world({ rules: { discoverEnabled: false } }).d.create("u1", { content: "Une publication valable" }), /fermé/);
  await assert.rejects(world({ rules: { discoverMaxPhotos: 1 } }).d.create("u1", { content: "Une publication valable", photos: [PNG, PNG] }), /1 photo au maximum/);
  await assert.rejects(world({ rules: { discoverMaxPhotos: 0 } }).d.create("u1", { content: "Une publication valable", photos: [PNG] }), /pas autorisées/);
  await assert.rejects(world({ rules: { discoverPostsPerDay: 2 }, postsToday: 2 }).d.create("u1", { content: "Une publication valable" }), /2 publications par 24/);
  await assert.rejects(world({ rules: { discoverRequirePhone: true } }).d.create("u1", { content: "Une publication valable" }), /PHONE/);
  assert.equal((await world({ rules: { discoverMaxPhotos: 6, discoverPostsPerDay: 50 } }).d.create("u1", { content: "Une publication valable", photos: [PNG, PNG, PNG, PNG, PNG] })).id.startsWith("pub_"), true);
  const closed = await world({ rules: { discoverEnabled: false } }).d.feed(null);
  assert.deepEqual([closed.items.length, closed.settings.enabled], [0, false]);
});

test("écrire à l'auteur et signaler : motif valable, pas sur sa propre publication, une fois par personne", async () => {
  const w = world();
  assert.deepEqual(await w.d.contact("u2", "p1", "Bonjour, je suis intéressé"), { threadId: "th1" });
  assert.deepEqual(w.sent[0], { u: "u2", p: "p1", b: "Bonjour, je suis intéressé" });
  await assert.rejects(w.d.report("u2", "p1", "n'importe quoi"), /motif/);
  await assert.rejects(w.d.report("u2", "zz", "Autre"), /introuvable/);
  await assert.rejects(w.d.report("author", "p1", "Autre"), /propre publication/);
  await w.d.report("u2", "p1", "Autre");
  assert.equal(w.inserted.at(-1).report, "Autre");
});

test("modération : réservée à l'équipe, motif obligatoire, masquage et rétablissement tracés", async () => {
  await assert.rejects(world({ role: "USER" }).d.hide("u9", "p1", "Spam répété"), /Réservé/);
  const w = world({ role: "MODERATOR" });
  await assert.rejects(w.d.hide("m1", "p1", "x"), /motif/);
  await assert.rejects(w.d.hide("m1", "zz", "Annonce déguisée"), /introuvable/);
  await w.d.hide("m1", "p1", "Annonce déguisée en demande");
  await w.d.restore("m1", "p1");
  assert.deepEqual(w.audit.map((a) => a.action), ["PUBLICATION_HIDE", "PUBLICATION_RESTORE"]);
  assert.equal(w.audit[0].details.reason, "Annonce déguisée en demande");
  assert.equal(w.audit[0].who, "m1");
});

test("messagerie : écrire à l'auteur d'une publication ouvre une conversation sans annonce, et refuse de s'écrire à soi-même", async () => {
  const calls = [];
  const q = async (sql, args = []) => {
    calls.push({ sql, args });
    if (/from ika_publications pb/.test(sql)) return args[0] === "p1" ? [{ id: "p1", owner_id: "author", title: "Je cherche un terrain" }] : [];
    if (/insert into ika_threads/.test(sql)) return [{ id: "th9", owner_id: "author", visitor_id: "u2" }];
    if (/count\(\*\)::int as n from ika_messages/.test(sql)) return [{ n: 0 }];
    if (/insert into ika_notifications/.test(sql)) return [{ id: "nt" }];
    return [];
  };
  const accounts = { ensureProfile: async () => ({ account_status: "ACTIVE" }), assertCanPublish: () => {}, requireActive: async () => ({}) };
  const e = createEngagement({ db: { query: q, transaction: async (f) => f({ query: q }) } }, accounts);
  assert.deepEqual(await e.sendToPublication("u2", "p1", "Bonjour, je suis intéressé"), { threadId: "th9" });
  const ins = calls.find((c) => /insert into ika_threads/.test(c.sql));
  assert.match(ins.sql, /publication_id/);
  assert.match(ins.sql, /on conflict \(publication_id, visitor_id\) where publication_id is not null/);
  assert.deepEqual(ins.args.slice(1), ["p1", "author", "u2"]);
  assert.ok(calls.some((c) => /insert into ika_messages/.test(c.sql)));
  assert.ok(calls.some((c) => /insert into ika_notifications/.test(c.sql) && /Je cherche un terrain/.test(c.args[3])));
  await assert.rejects(e.sendToPublication("author", "p1", "Bonjour à moi"), /propre publication/);
  await assert.rejects(e.sendToPublication("u2", "zz", "Bonjour"), /introuvable/);
  await assert.rejects(e.sendToPublication("u2", "p1", "a"), /trop court/);
});
