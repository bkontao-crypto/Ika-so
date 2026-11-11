// Quartiers et pays : fausse base ; on vérifie droits SUPERADMIN, validations, protections et rechargement des listes.
import test from "node:test";
import assert from "node:assert/strict";
import { createPlaces, validTimezone } from "../server/services/places.js";
import { ZONES, ALL_ZONES, COUNTRIES, applyPlaces, resolveCountry, zonePoint } from "../server/lib/places.js";

function setup(rowsFor = {}) {
  const calls = []; const audits = [];
  const db = { calls, query: async (sql, params = []) => {
    calls.push({ sql, params });
    for (const [re, fn] of Object.entries(rowsFor)) if (new RegExp(re).test(sql)) return fn(params);
    return [];
  } };
  const accounts = {
    requireStaff: async (id, min) => { if (id !== "super" || min !== "SUPERADMIN") { const e = new Error("Réservé au Superadmin."); e.status = 403; throw e; } },
    audit: async (...a) => { audits.push(a); },
  };
  return { svc: createPlaces({ db, accounts }), calls, audits };
}
const ML = { code: "ML", active: true };
const zoneRow = (o = {}) => ({ id: "z1", name: "Magnambougou", country_code: "ML", latitude: 12.6, longitude: -7.9, active: true, ...o });

test("seul le Superadmin gère quartiers et pays (un administrateur ordinaire est refusé)", async () => {
  const { svc } = setup();
  const ok = { name: "X", countryCode: "ML", lat: 1, lng: 1 };
  for (const fn of [() => svc.listForOwner("admin"), () => svc.createZone("admin", ok), () => svc.createZones("admin", { countryCode: "ML", lines: "a;1;1" }),
    () => svc.updateZone("admin", "z", ok), () => svc.setZoneActive("admin", "z", false), () => svc.removeZone("admin", "z"),
    () => svc.createCountry("admin", {}), () => svc.updateCountry("admin", "ML", {}), () => svc.setCountryActive("admin", "ML", false), () => svc.removeCountry("admin", "ML")])
    await assert.rejects(fn(), /Superadmin/);
});

test("quartier : nom, pays, coordonnées et doublons contrôlés", async () => {
  const { svc } = setup({ "from ika_countries where code": (p) => (p[0] === "ML" ? [ML] : []), "select id, name from ika_zones": () => [{ id: "z0", name: "Sotuba" }] });
  const base = { name: "Magnambougou", countryCode: "ML", lat: "12,628", lng: "-7.953" };
  await assert.rejects(svc.createZone("super", { ...base, name: " " }), /nom du quartier/i);
  await assert.rejects(svc.createZone("super", { ...base, countryCode: "ZZ" }), /pays/i);
  await assert.rejects(svc.createZone("super", { ...base, lat: "91" }), /Latitude/);
  await assert.rejects(svc.createZone("super", { ...base, lng: "abc" }), /Longitude/);
  await assert.rejects(svc.createZone("super", { ...base, name: "sotuba" }), /existe déjà/);
  await assert.rejects(svc.createZone("super", { ...base, name: "SÖTUBA!" }), /existe déjà/); // même adresse de page
});

test("création d'un quartier : écrit, journalise, recharge les listes en mémoire", async () => {
  const { svc, calls, audits } = setup({
    "from ika_countries where code": () => [ML], "select id, name from ika_zones": () => [], "count\\(\\*\\)::int as n from ika_zones": () => [{ n: 3 }],
    "insert into ika_zones": (p) => [zoneRow({ id: p[0], name: p[1] })],
    "from ika_countries where active": () => [{ code: "ML", name: "Mali", currency: "XOF", timezone: "Africa/Bamako" }],
    "select name, latitude": () => [{ name: "Magnambougou", latitude: 12.628, longitude: -7.953, country_code: "ML", active: true }],
  });
  const out = await svc.createZone("super", { name: "Magnambougou", countryCode: "ml", lat: "12.628", lng: "-7.953" });
  assert.equal(out.name, "Magnambougou");
  assert.equal(audits[0][1], "ZONE_CREATE");
  assert.ok(calls.some((c) => /insert into ika_zones/.test(c.sql)));
  assert.deepEqual(ZONES.map((z) => z.name), ["Magnambougou"]);
  assert.equal(zonePoint("Magnambougou").lat, 12.628);
});

test("ajout en lot : tout ou rien, ligne fautive indiquée, doublon interne refusé", async () => {
  const { svc, calls } = setup({ "from ika_countries where code": () => [ML], "select id, name from ika_zones": () => [], "count\\(\\*\\)::int as n from ika_zones": () => [{ n: 0 }] });
  await assert.rejects(svc.createZones("super", { countryCode: "ML", lines: "" }), /Aucune ligne/);
  await assert.rejects(svc.createZones("super", { countryCode: "ML", lines: "Aa;12;-8\nBb;12" }), /Ligne 2/);
  await assert.rejects(svc.createZones("super", { countryCode: "ML", lines: "Aa;12;-8\nBb;200;-8" }), /Ligne 2.*Latitude/);
  await assert.rejects(svc.createZones("super", { countryCode: "ML", lines: "Aa;12;-8\naa;12;-8" }), /deux fois/);
  assert.ok(!calls.some((c) => /insert into ika_zones/.test(c.sql)), "rien n'est écrit si une ligne est fausse");
  const r = await svc.createZones("super", { countryCode: "ML", lines: "Aa;12;-8\nBb;12.1;-8.1" });
  assert.equal(r.added, 2);
  assert.equal(calls.filter((c) => /insert into ika_zones/.test(c.sql)).length, 2);
});

test("renommer ou supprimer un quartier qui a des annonces est refusé (masquer à la place)", async () => {
  const { svc } = setup({
    "select \\* from ika_zones where id": () => [zoneRow()], "from ika_countries where code": () => [ML],
    "select id, name from ika_zones": () => [{ id: "z1", name: "Magnambougou" }], "from ika_listings where neighborhood": () => [{ n: 4 }],
  });
  await assert.rejects(svc.updateZone("super", "z1", { name: "Magnambougou 2", countryCode: "ML", lat: 1, lng: 1 }), /annonces/);
  await assert.rejects(svc.removeZone("super", "z1"), /masquez/i);
  const out = await svc.updateZone("super", "z1", { name: "Magnambougou", countryCode: "ML", lat: 12.7, lng: -7.9 }).catch((e) => e);
  assert.notEqual(out?.status, 409, "mêmes nom : modifier les coordonnées reste permis");
});

test("pays : code, devise, fuseau ; dernier pays actif non désactivable ; suppression refusée s'il est utilisé", async () => {
  assert.ok(validTimezone("Africa/Bamako")); assert.ok(!validTimezone("Mars/Olympus")); assert.ok(!validTimezone("pas un fuseau"));
  const { svc } = setup({
    "select \\* from ika_countries where code": () => [{ code: "ML", name: "Mali", currency: "XOF", timezone: "Africa/Bamako", active: true }],
    "count\\(\\*\\)::int as n from ika_countries": () => [{ n: 0 }],
    "from ika_zones where country_code": () => [{ zones: 10 }], "from ika_listings where country_code": () => [{ listings: 0 }],
  });
  const good = { code: "sn", name: "Sénégal", currency: "xof", timezone: "Africa/Dakar" };
  await assert.rejects(svc.createCountry("super", { ...good, code: "SEN" }), /2 lettres/);
  await assert.rejects(svc.createCountry("super", { ...good, currency: "FCFA" }), /3 lettres/);
  await assert.rejects(svc.createCountry("super", { ...good, timezone: "Mars/Olympus" }), /Fuseau/);
  await assert.rejects(svc.setCountryActive("super", "ML", false), /Au moins un pays/);
  await assert.rejects(svc.removeCountry("super", "ML"), /désactivez-le/);
});

test("listes en mémoire : quartiers masqués absents des formulaires mais position conservée ; pays inconnu refusé", () => {
  applyPlaces({
    countries: [{ code: "ML", name: "Mali" }, { code: "SN", name: "Sénégal" }],
    zones: [{ name: "Kati", lat: 1, lng: 2, country: "ML", active: true }, { name: "Vieux", lat: 3, lng: 4, country: "ML", active: false }, { name: "Plateau", lat: 5, lng: 6, country: "SN", active: true }, { name: "Orphelin", lat: 7, lng: 8, country: "XX", active: true }],
  });
  assert.deepEqual(ZONES.map((z) => z.name), ["Kati", "Plateau"]);
  assert.equal(ALL_ZONES.length, 4);
  assert.equal(zonePoint("Vieux").lat, 3);
  assert.equal(resolveCountry("sn"), "SN");
  assert.equal(resolveCountry(""), "ML");
  assert.equal(resolveCountry("ZZ"), null);
  assert.equal(COUNTRIES.length, 2);
});
