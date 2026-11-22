// En-tête personnalisable : contraste, validation des onglets, blocage des couleurs illisibles, logo, hero.
import test from "node:test";
import assert from "node:assert/strict";
import { ratio, level, suggestInk, blend, normalizeHex } from "../public/js/lib/contrast.js";
import { createSiteHeader, SYSTEM_TABS } from "../server/services/site-header.js";
import { createHomepageSettings } from "../server/services/homepage-settings.js";

test("contraste : noir/blanc = 21, même couleur = 1, niveaux", () => {
  assert.equal(ratio("#000", "#fff"), 21);
  assert.equal(ratio("#123456", "#123456"), 1);
  assert.equal(level(21), "ok"); assert.equal(level(3.5), "low"); assert.equal(level(2), "bad"); assert.equal(level(null), "bad");
  assert.equal(normalizeHex("#ABC"), "#aabbcc"); assert.equal(normalizeHex("rouge"), null);
  assert.equal(ratio("#fff", "pas-une-couleur"), null);
});
test("suggestion : la couleur proposée est toujours lisible", () => {
  for (const [fg, bg] of [["#ffffff", "#00a9ef"], ["#087cff", "#ffffff"], ["#777777", "#888888"], ["#000000", "#001122"]]) {
    const fix = suggestInk(fg, bg);
    assert.ok(ratio(fix, bg) >= 4.5, `${fg} sur ${bg} → ${fix}`);
  }
  assert.equal(suggestInk("#111111", "#ffffff"), "#111111"); // déjà lisible : inchangé
  assert.equal(blend("#000000", "#ffffff", 0.5), "#808080");
});

const fakeDb = () => {
  const kv = new Map();
  return { kv, async query(sql, p = []) {
    if (/^select value from ika_settings/.test(sql)) return kv.has(p[0]) ? [{ value: kv.get(p[0]) }] : [];
    if (/^insert into ika_settings/.test(sql)) { kv.set(p[0], p[1]); return []; }
    return [];
  } };
};
const accounts = (deny = false) => ({ requirePermission: async () => { if (deny) throw new Error("interdit"); }, audit: async () => {} });
const make = (deny) => { const db = fakeDb(); return { db, svc: createSiteHeader({ db, accounts: accounts(deny) }) }; };
const tabs = (extra = []) => [...SYSTEM_TABS.map((t) => ({ ...t, visible: true })), ...extra];

test("par défaut : onglets d'origine, couleurs du thème, logo vide", async () => {
  const { svc } = make();
  const g = await svc.get();
  assert.deepEqual(g.tabs.map((t) => t.id), SYSTEM_TABS.map((t) => t.id));
  assert.equal(g.light.bg, ""); assert.equal(g.logoUrl, ""); assert.equal(g.publishVisible, true);
});
test("ajout, renommage, ordre et masquage ; un onglet d'origine omis est masqué, pas perdu", async () => {
  const { svc } = make();
  const out = await svc.save("u", { tabs: [{ id: "c_abc12345", label: "Blog", href: "https://exemple.ml/blog" }, { id: "buy", label: "À vendre" }, { id: "home", label: "Accueil", visible: true }] });
  assert.equal(out.tabs[0].label, "Blog"); assert.equal(out.tabs[0].custom, true);
  assert.equal(out.tabs[1].href, "#/annonces?t=Vente"); // le lien d'un onglet d'origine ne change pas
  const rent = out.tabs.find((t) => t.id === "rent");
  assert.equal(rent.visible, false);
  const g = await svc.get();
  assert.equal(g.tabs[1].label, "À vendre");
});
test("refus : lien dangereux, doublon, trop long, aucun onglet visible, trop d'onglets", async () => {
  const { svc } = make();
  const bad = (t) => assert.rejects(() => svc.save("u", { tabs: t }), /./);
  await bad(tabs([{ id: "c_aaaa1111", label: "X", href: "javascript:alert(1)" }]));
  await bad(tabs([{ id: "c_aaaa1111", label: "X", href: "http://pas-https.ml" }]));
  await bad(tabs([{ id: "c_aaaa1111", label: "X", href: "//evil.ml" }]));
  await bad([{ id: "home", label: "A" }, { id: "home", label: "B" }]);
  await bad([{ id: "home", label: "x".repeat(25) }]);
  await bad(SYSTEM_TABS.map((t) => ({ ...t, visible: false })));
  await bad(Array.from({ length: 17 }, (_, i) => ({ id: `c_aaaa${1000 + i}`, label: "L", href: "#/" })));
  await bad([{ id: "pirate", label: "Pirate", href: "#/" }]);
});
test("couleurs : illisible = publication bloquée, avec la couleur proposée ; lisible = acceptée", async () => {
  const { svc } = make();
  await assert.rejects(() => svc.save("u", { tabs: tabs(), light: { bg: "#00a9ef", ink: "#ffffff" } }), /Publication bloquée.*illisible.*#/s);
  await assert.rejects(() => svc.save("u", { tabs: tabs(), light: { bg: "#00a9ef", ink: "" } }), /ET/);
  await assert.rejects(() => svc.save("u", { tabs: tabs(), light: { bg: "rouge", ink: "#000" } }), /invalide/);
  const ok = await svc.save("u", { tabs: tabs(), light: { bg: "#0b3d2e", ink: "#ffffff" }, dark: { bg: "#111", ink: "#eee" } });
  assert.equal(ok.light.bg, "#0b3d2e"); assert.equal(ok.dark.bg, "#111111");
});
test("droits : sans permission, rien n'est enregistré", async () => {
  const { svc, db } = make(true);
  await assert.rejects(() => svc.save("u", { tabs: tabs() }), /interdit/);
  assert.equal(db.kv.size, 0);
});
test("logo : fichier du site ou import en attente seulement ; devient le logo du site", async () => {
  const { svc, db } = make();
  await assert.rejects(() => svc.save("u", { tabs: tabs(), logoUrl: "https://evil.ml/x.png" }), /Logo/);
  await assert.rejects(() => svc.save("u", { tabs: tabs(), logoUrl: "/api/media/11111111-1111-1111-1111-111111111111" }), /Logo/); // fichier jamais importé
  const ok = await svc.save("u", { tabs: tabs(), logoUrl: "/media/logo-ika-so.webp" });
  assert.equal(ok.logoUrl, "/media/logo-ika-so.webp");
  assert.equal(db.kv.get("platform_logo"), "/media/logo-ika-so.webp");
  db.kv.set("site_header_logo_pending", "/api/media/22222222-2222-2222-2222-222222222222");
  const pub = await svc.save("u", { tabs: tabs(), logoUrl: "/api/media/22222222-2222-2222-2222-222222222222" });
  assert.equal(pub.logoUrl, "/api/media/22222222-2222-2222-2222-222222222222");
  assert.equal(db.kv.get("site_header_logo_pending"), ""); // plus d'attente
  const reset = await svc.save("u", { tabs: tabs(), logoUrl: "" });
  assert.equal(reset.logoUrl, "");
});
test("une valeur enregistrée altérée ne casse jamais l'en-tête", async () => {
  const { svc, db } = make();
  db.kv.set("site_header", "{pas du json");
  assert.equal((await svc.get()).tabs.length, SYSTEM_TABS.length);
  db.kv.set("site_header", JSON.stringify({ tabs: [{ id: "home", label: "" }] }));
  assert.equal((await svc.get()).tabs.length, SYSTEM_TABS.length);
});

test("héros : texte illisible sur le voile = enregistrement bloqué ; voile léger = non bloqué", async () => {
  let saved = null;
  const db = { async query(sql, p = []) { if (/select config/.test(sql)) return []; if (/insert into ika_homepage_settings/.test(sql)) saved = p[0]; return []; } };
  const svc = createHomepageSettings({ db, accounts: accounts() });
  const base = { image: "/media/villa-badala.jpg", overlayOpacity: "0.8" };
  await assert.rejects(() => svc.save("u", { ...base, overlayColor: "#ffffff", textColor: "#ffffff" }), /Publication bloquée/);
  await svc.save("u", { ...base, overlayColor: "#091f19", textColor: "#ffffff", accentColor: "#c9ef75" });
  assert.ok(saved);
  await svc.save("u", { ...base, overlayOpacity: "0.2", overlayColor: "#ffffff", textColor: "#ffffff" }); // photo dominante : non calculable
});

test("sections de l'accueil : ordre, masquage, rien de perdu, refus des inconnues", async () => {
  const { svc, db } = make();
  assert.equal((await svc.getLayout()).sections.length, 14);
  const out = await svc.saveLayout("u", { sections: [{ id: "guides", visible: true }, { id: "latest", visible: false }] });
  assert.equal(out.sections[0].id, "guides");
  assert.equal(out.sections.find((x) => x.id === "latest").visible, false);
  assert.equal(out.sections.length, 14); // les sections omises sont ajoutées, visibles
  assert.equal(out.sections.find((x) => x.id === "partners").visible, true);
  await assert.rejects(() => svc.saveLayout("u", { sections: [{ id: "pirate" }] }), /invalide/);
  await assert.rejects(() => svc.saveLayout("u", { sections: [{ id: "how" }, { id: "how" }] }), /double/);
  db.kv.set("home_layout", "{casse");
  assert.equal((await svc.getLayout()).sections.length, 14);
  await assert.rejects(() => make(true).svc.saveLayout("u", { sections: [] }), /interdit/);
});

test("textes des sections : enregistrés en texte brut, vides ignorés, limites et sections inconnues refusées", async () => {
  const { svc } = make();
  const out = await svc.saveLayout("u", { sections: [], texts: { latest: { kicker: " Neuf ", title: "Nos biens <b>", text: "" }, how: { title: "" } } });
  assert.deepEqual(out.texts, { latest: { kicker: "Neuf", title: "Nos biens <b>" } }); // stocké tel quel ; affiché comme texte
  assert.deepEqual((await svc.getLayout()).texts, out.texts);
  await assert.rejects(() => svc.saveLayout("u", { texts: { latest: { title: "x".repeat(121) } } }), /limité/);
  await assert.rejects(() => svc.saveLayout("u", { texts: { pirate: { title: "x" } } }), /invalide/);
  await assert.rejects(() => svc.saveLayout("u", { texts: { download: { title: "x" } } }), /invalide/);
});

test("pied de page : défaut = page d'origine ; modification validée ; liens dangereux refusés", async () => {
  const { svc, db } = make();
  const g = await svc.getFooter();
  assert.equal(g.columns.length, 3); assert.equal(g.columns[0].links[0].href, "#/annonces?t=Vente");
  const out = await svc.saveFooter("u", { intro: "Bienvenue", copyright: "Ika", columns: [{ title: "Liens", links: [{ label: "Blog", href: "https://exemple.ml/blog" }, { label: "Guides", href: "/guides" }, { label: "Carte", href: "#/carte" }] }] });
  assert.equal(out.columns.length, 1); assert.equal((await svc.getFooter()).intro, "Bienvenue");
  const bad = (f) => assert.rejects(() => svc.saveFooter("u", f), /./);
  const col = (links) => ({ intro: "x", copyright: "y", columns: [{ title: "T", links }] });
  await bad(col([{ label: "X", href: "javascript:alert(1)" }]));
  await bad(col([{ label: "X", href: "//evil.ml" }]));
  await bad(col([{ label: "X", href: "http://pas-https.ml" }]));
  await bad(col([{ label: "", href: "#/" }]));
  await bad(col(Array.from({ length: 11 }, () => ({ label: "L", href: "#/" }))));
  await bad({ intro: "x", copyright: "y", columns: Array.from({ length: 5 }, () => ({ title: "T", links: [] })) });
  await bad({ intro: "", copyright: "y", columns: [] });
  await assert.rejects(() => make(true).svc.saveFooter("u", g), /interdit/);
  db.kv.set("site_footer", "{casse");
  assert.equal((await svc.getFooter()).columns.length, 3); // valeur altérée : page d'origine
});

test("barre du bas mobile : 3 à 5 accès du catalogue, « Compte » obligatoire", async () => {
  const { svc } = make();
  assert.deepEqual((await svc.get()).mobile, ["home", "discover", "publish", "map", "account"]);
  const ok = await svc.save("u", { tabs: tabs(), mobile: ["alerts", "inbox", "account"] });
  assert.deepEqual(ok.mobile, ["alerts", "inbox", "account"]);
  const bad = (m) => assert.rejects(() => svc.save("u", { tabs: tabs(), mobile: m }), /Barre du bas/);
  await bad(["home", "map"]);                                             // trop court
  await bad(["home", "map", "buy", "rent", "land", "account"]);           // trop long
  await bad(["home", "map", "buy"]);                                      // sans Compte
  await bad(["home", "home", "account"]);                                 // doublon
  await bad(["home", "pirate", "account"]);                               // inconnu
  assert.ok((await svc.getForStaff("u")).mobileCatalog.length >= 12);
});
