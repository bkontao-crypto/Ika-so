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

test("cartes de l'accueil : titre/texte modifiables, nombre et sections bornés, vides ignorés", async () => {
  const { svc } = make();
  const out = await svc.saveLayout("u", { cards: { how: [{ title: "Cherchez", text: "" }, { title: "", text: "" }], trust: [{ title: "", text: "" }] } });
  assert.deepEqual(out.cards, { how: [{ title: "Cherchez", text: "" }, { title: "", text: "" }] }); // trust vide : ignoré
  assert.deepEqual((await svc.getLayout()).cards, out.cards);
  const bad = (c) => assert.rejects(() => svc.saveLayout("u", { cards: c }), /./);
  await bad({ pirate: [{ title: "x" }] });
  await bad({ how: Array.from({ length: 4 }, () => ({ title: "x" })) });
  await bad({ how: [{ title: "x".repeat(61) }] });
  await bad({ trust: [{ text: "x".repeat(201) }] });
  assert.equal((await svc.getForStaff("u")).mobileCatalog.length > 0, true);
});

const blk = (o = {}) => ({ type: "cta", title: "Publiez", text: "Texte", imageUrl: "", alt: "", buttonLabel: "Go", buttonHref: "#/publier", bg: "#0b3d2e", ink: "#ffffff", devices: { desktop: true, tablet: true, mobile: false }, ...o });
const withBlock = (b, id = "b_abc12345") => ({ sections: [{ id, visible: true, custom: true, block: b }] });

test("blocs libres : création, ordre parmi les sections, affichage par appareil", async () => {
  const { svc } = make();
  const out = await svc.saveLayout("u", withBlock(blk()));
  assert.equal(out.sections[0].custom, true); assert.equal(out.sections[0].block.devices.mobile, false);
  assert.equal(out.sections.length, 15); // 14 sections d'origine + 1 bloc
  const g = await svc.getLayout(); assert.equal(g.sections[0].block.title, "Publiez");
});
test("blocs libres : refus des contenus dangereux ou invalides", async () => {
  const { svc } = make();
  const bad = (b, re = /./) => assert.rejects(() => svc.saveLayout("u", withBlock(b)), re);
  await bad(blk({ type: "pirate" }), /Type/);
  await bad(blk({ title: "", text: "", imageUrl: "" }), /vide/);
  await bad(blk({ title: "x".repeat(121) }), /120/);
  await bad(blk({ buttonHref: "javascript:alert(1)" }), /Lien/);
  await bad(blk({ buttonLabel: "Go", buttonHref: "" }), /ET/);
  await bad(blk({ imageUrl: "https://evil.ml/x.png" }), /Image/);
  await bad(blk({ type: "image", imageUrl: "" }), /image/);
  await bad(blk({ imageUrl: "/api/media/11111111-1111-1111-1111-111111111111" }), /Image/); // jamais importée
  await bad(blk({ devices: { desktop: false, tablet: false, mobile: false } }), /appareil/);
  await bad(blk({ bg: "rouge" }), /invalide/);
  await assert.rejects(() => svc.saveLayout("u", { sections: [{ id: "b_abc12345", visible: true, custom: true }] }), /Bloc invalide/);
  await assert.rejects(() => svc.saveLayout("u", { sections: [{ id: "b_abc12345", block: blk() }, { id: "b_abc12345", block: blk() }] }), /double/);
  await assert.rejects(() => svc.saveLayout("u", { sections: Array.from({ length: 13 }, (_, i) => ({ id: `b_aaaa${1000 + i}`, block: blk() })) }), /12/);
});
test("blocs libres : texte illisible sur sa couleur = publication bloquée", async () => {
  const { svc } = make();
  await assert.rejects(() => svc.saveLayout("u", withBlock(blk({ bg: "#00a9ef", ink: "#ffffff" }))), /Publication bloquée.*illisible/s);
  await assert.rejects(() => svc.saveLayout("u", withBlock(blk({ bg: "#00a9ef", ink: "" }))), /ET/);
  await svc.saveLayout("u", withBlock(blk({ bg: "", ink: "" }))); // sans couleur : couleurs du thème
});
test("blocs libres : une image importée n'est acceptée qu'après import, puis reste valable", async () => {
  const { svc, db } = make();
  const url = "/api/media/22222222-2222-4222-8222-222222222222";
  await assert.rejects(() => svc.saveLayout("u", withBlock(blk({ type: "image", imageUrl: url }))), /Image/);
  db.kv.set("home_block_pending", JSON.stringify([url]));
  const ok = await svc.saveLayout("u", withBlock(blk({ type: "image", imageUrl: url })));
  assert.equal(ok.sections[0].block.imageUrl, url);
  assert.equal(db.kv.get("home_block_pending"), "[]");
  await svc.saveLayout("u", withBlock(blk({ type: "image", imageUrl: url, title: "Autre" }))); // déjà publiée : reste acceptée
  const st = await svc.saveLayout("u", withBlock(blk({ type: "image", imageUrl: "/media/villa-badala.jpg" })));
  assert.equal(st.sections[0].block.imageUrl, "/media/villa-badala.jpg");
});

test("brouillon de l'accueil : validé comme la publication, invisible du public, publié puis effacé", async () => {
  const { svc, db } = make();
  const d = await svc.saveLayoutDraft("u", withBlock(blk({ title: "Brouillon" })));
  assert.equal(d.sections[0].block.title, "Brouillon");
  assert.equal((await svc.getLayout()).sections.some((x) => x.custom), false); // public : inchangé
  assert.equal((await svc.previewLayout("u")).sections[0].block.title, "Brouillon");
  assert.equal((await svc.getLayoutForStaff("u")).draft.sections[0].block.title, "Brouillon");
  await assert.rejects(() => svc.saveLayoutDraft("u", withBlock(blk({ bg: "#00a9ef", ink: "#ffffff" }))), /illisible/); // même garde-fou
  await svc.saveLayout("u", withBlock(blk({ title: "Publié" })));
  assert.equal(db.kv.get("home_layout_draft"), ""); // brouillon effacé à la publication
  assert.equal((await svc.getLayout()).sections[0].block.title, "Publié");
  assert.equal((await svc.previewLayout("u")).sections[0].block.title, "Publié"); // sans brouillon : la version publiée
  await svc.saveLayoutDraft("u", withBlock(blk()));
  await svc.discardLayoutDraft("u");
  assert.equal((await svc.getLayoutForStaff("u")).draft, null);
  db.kv.set("home_layout_draft", "{casse");
  assert.equal((await svc.previewLayout("u")).sections[0].block.title, "Publié"); // brouillon altéré : ignoré
  await assert.rejects(() => make(true).svc.saveLayoutDraft("u", {}), /interdit/);
  await assert.rejects(() => make(true).svc.previewLayout("u"), /interdit/);
});
test("galerie : 1 à 6 images valides, description bornée", async () => {
  const { svc, db } = make();
  const img = (n) => ({ url: `/media/g${n}.jpg`, alt: `Photo ${n}` });
  const g = (images) => blk({ type: "gallery", images, bg: "", ink: "" });
  const ok = await svc.saveLayout("u", withBlock(g([img(1), img(2)])));
  assert.equal(ok.sections[0].block.images.length, 2);
  await assert.rejects(() => svc.saveLayout("u", withBlock(g([]))), /au moins une/);
  await assert.rejects(() => svc.saveLayout("u", withBlock(g(Array.from({ length: 7 }, (_, n) => img(n))))), /6/);
  await assert.rejects(() => svc.saveLayout("u", withBlock(g([{ url: "https://evil.ml/x.png", alt: "" }]))), /Galerie/);
  await assert.rejects(() => svc.saveLayout("u", withBlock(g([{ url: "/api/media/55555555-5555-4555-8555-555555555555", alt: "" }]))), /Galerie/);
  db.kv.set("home_block_pending", JSON.stringify(["/api/media/55555555-5555-4555-8555-555555555555"]));
  await svc.saveLayout("u", withBlock(g([{ url: "/api/media/55555555-5555-4555-8555-555555555555", alt: "x".repeat(10) }])));
  await assert.rejects(() => svc.saveLayout("u", withBlock(g([{ url: "/media/g1.jpg", alt: "x".repeat(121) }]))), /120/);
});

// --- Corrections issues de la revue (23 novembre 2026) ---
test("revue B1 : le plafond d'onglets tient compte des onglets d'origine ajoutés (rien ne dépasse 16, la lecture ne retombe pas sur les défauts)", async () => {
  const { svc } = make();
  const custom = Array.from({ length: 12 }, (_, i) => ({ id: `c_aaaa${1000 + i}`, label: `L${i}`, href: "#/" }));
  const three = SYSTEM_TABS.slice(0, 3).map((t) => ({ ...t, visible: true }));
  await assert.rejects(() => svc.save("u", { tabs: [...custom, ...three] }), /16/);  // 12 + 3 + 5 omis = 20 : refusé
  const ok = await svc.save("u", { tabs: [...custom.slice(0, 8), ...SYSTEM_TABS.map((t) => ({ ...t, visible: true }))] }); // 8 + 8 = 16 : accepté
  assert.equal((await svc.get()).tabs.length, 16); assert.equal(ok.tabs.length, 16);
});
test("revue B2 : clés héritées (constructor, __proto__) refusées pour les cartes", async () => {
  const { svc } = make();
  await assert.rejects(() => svc.saveLayout("u", { cards: { constructor: [{ title: "x" }] } }), /invalides/);
  await assert.rejects(() => svc.saveLayout("u", JSON.parse('{"cards":{"__proto__":[{"title":"x"}]}}')), /invalides/);
});
test("revue B3 : un bloc Formulaire sans titre ni texte est accepté (champs fixes), pas un bloc texte vide", async () => {
  const { svc } = make();
  await svc.saveLayout("u", withBlock(blk({ type: "form", title: "", text: "", buttonLabel: "", buttonHref: "", bg: "", ink: "" })));
  await assert.rejects(() => svc.saveLayout("u", withBlock(blk({ type: "text", title: "", text: "", buttonLabel: "", buttonHref: "", bg: "", ink: "" }))), /vide/);
});
test("revue B4 : publier ne perd pas l'image importée en attente par un autre membre du personnel", async () => {
  const { svc, db } = make();
  const mine = "/api/media/88888888-8888-4888-8888-888888888888", other = "/api/media/99999999-9999-4999-8999-999999999999";
  db.kv.set("home_block_pending", JSON.stringify([mine, other]));
  await svc.saveLayout("u", withBlock(blk({ type: "image", imageUrl: mine })));
  assert.deepEqual(JSON.parse(db.kv.get("home_block_pending")), [other]);
});
test("revue S1 : la liste des images publiques ne contient que les fichiers des blocs affichés (pas les textes libres, pas les blocs masqués)", async () => {
  const { svc, db } = make();
  const shown = "/media/a.jpg", hidden = "/media/b.jpg", cited = "/api/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  await svc.saveLayout("u", { sections: [
    { id: "b_shown001", visible: true, custom: true, block: blk({ type: "image", imageUrl: shown, text: `voir ${cited}` }) },
    { id: "b_hidden01", visible: false, custom: true, block: blk({ type: "image", imageUrl: hidden }) },
    { id: "b_gallery1", visible: true, custom: true, block: blk({ type: "gallery", images: [{ url: "/media/g.jpg", alt: "" }], bg: "", ink: "" }) },
  ] });
  assert.deepEqual(JSON.parse(db.kv.get("home_published_images")).sort(), ["/media/a.jpg", "/media/g.jpg"]);
});
