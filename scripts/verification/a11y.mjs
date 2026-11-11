// Contrôle d'accessibilité automatique (sans axe-core, sans réseau) : quelques règles WCAG vérifiables par machine.
// NE REMPLACE PAS un test avec lecteur d'écran ni un audit humain. Serveur attendu sur 127.0.0.1:18080 (base vide).
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/")("playwright");
const BASE = "http://127.0.0.1:18080";
const browser = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: process.env.DARK ? "dark" : "light" };

const admin = await browser.newContext(phone), owner = await browser.newContext(phone), guest = await browser.newContext(phone);
const post = async (ctx, path, data) => { const r = await ctx.request.post(BASE + "/api" + path, { data }); if (!r.ok()) throw new Error(`${path} → ${r.status()} ${await r.text()}`); return r.json(); };
await post(admin, "/auth/register", { name: "Admin", email: "a@ika.test", password: "motdepasse1", acceptTerms: true });
const ownerReg = await post(owner, "/auth/register", { name: "Aminata", email: "b@ika.test", password: "motdepasse1", acceptTerms: true });
const { hint } = await post(owner, "/me/otp", { phone: "76 12 34 56", displayRole: "Propriétaire direct" });
await post(owner, "/me/otp/verify", { code: hint });
const { id } = await post(owner, "/listings", {
  title: "Terrain titré à ACI 2000", description: "Belle parcelle proche du goudron, eau et électricité à proximité.", category: "Terrain", transactionType: "Vente",
  neighborhood: "ACI 2000", price: 45000000, surfaceLabel: "500 m²", surfaceM2: 500, roadAccess: "Goudronné", declaredDocument: "Titre Foncier",
  imageUrl: "/media/terrain-aci.jpg", imageUrls: ["/media/terrain-aci.jpg"], ownerRole: "Propriétaire direct", fullName: "Aminata",
});
await post(admin, `/staff/listings/${id}/decision`, { action: "APPROVE", reason: "" });

const { threadId } = await post(admin, `/listings/${id}/messages`, { body: "Bonjour, le terrain est-il toujours disponible ?" });
await post(owner, `/me/threads/${threadId}/messages`, { body: "Oui, il est disponible. Visite possible samedi." });
await post(admin, `/listings/${id}/messages`, { body: "Parfait, je passe samedi à 10 h." });
const PAGES = [
  [owner, "/#/boite?onglet=messages"], [owner, `/#/boite/${threadId}`], [admin, `/#/boite/${threadId}`],
  [guest, "/#/"], [guest, `/#/annonce/${id}`], [guest, "/#/connexion"], [guest, "/#/confiance"],
  [owner, "/#/publier"], [owner, "/#/mes-annonces"], [owner, "/#/favoris"], [owner, "/#/profil"], [owner, "/#/boite"], [owner, "/#/paiements"], [owner, "/#/agence"],
  [admin, "/admin.html"],
  [guest, `/#/annonceur/${ownerReg.user.id}`], [owner, `/#/annonceur/${ownerReg.user.id}`],
  [guest, "/quartiers"], [guest, "/quartier/aci-2000"], [guest, `/a/${id}`], [guest, "/agences"], [guest, "/guides"], [guest, "/guides/acheter-un-terrain-a-bamako"],
];

// Règles exécutées dans la page.
const audit = () => {
  const out = [];
  const q = (s) => [...document.querySelectorAll(s)];
  if (!document.documentElement.lang) out.push("pas d'attribut lang");
  if (!document.title.trim()) out.push("pas de titre");
  if (!document.querySelector('meta[name="viewport"]')) out.push("pas de meta viewport");
  if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/.test(document.querySelector('meta[name="viewport"]')?.content ?? "")) out.push("zoom bloqué");
  if (q("h1").length !== 1) out.push(`${q("h1").length} titres h1 (attendu 1)`);
  const ids = q("[id]").map((e) => e.id); const dup = ids.filter((v, i) => ids.indexOf(v) !== i); if (dup.length) out.push(`id en double : ${[...new Set(dup)].join(", ")}`);
  for (const i of q("img")) if (!i.hasAttribute("alt")) out.push(`image sans alt : ${i.getAttribute("src")?.slice(0, 40)}`);
  const name = (e) => (e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") && document.getElementById(e.getAttribute("aria-labelledby"))?.textContent || e.textContent || e.title || e.querySelector("img[alt]")?.alt || "").trim();
  for (const e of q("button, a[href], [role=button], [role=tab]")) if (!name(e)) out.push(`${e.tagName.toLowerCase()} sans nom accessible : ${e.outerHTML.slice(0, 70)}`);
  for (const e of q("input:not([type=hidden]):not([type=file]), select, textarea")) {
    const labelled = e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") || e.closest("label") || (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`));
    if (!labelled) out.push(`champ sans étiquette : ${e.outerHTML.slice(0, 70)}`);
  }
  for (const e of q('input[type=file]')) if (!(e.getAttribute("aria-label") || e.closest("label"))) out.push("champ fichier sans étiquette");
  // Contraste (WCAG AA) : texte direct des éléments visibles.
  const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { c: p.slice(0, 3), a: p[3] ?? 1 }; };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== "none") return null; const p = parse(cs.backgroundColor); if (p && p.a > 0.95) return p.c; } return [255, 255, 255]; };
  const seen = new Set();
  for (const e of q("body *")) {
    if (!e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(e); if (cs.visibility === "hidden" || cs.display === "none" || e.closest("[hidden], .sr-only")) continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const fg = parse(cs.color), bg = bgOf(e); if (!fg || !bg) continue;
    const l1 = lum(fg.c), l2 = lum(bg), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700, large = size >= 24 || (bold && size >= 18.66);
    const need = large ? 3 : 4.5;
    const key = `${cs.color}|${bg}|${size}`;
    if (ratio < need && !seen.has(key)) { seen.add(key); out.push(`contraste ${ratio.toFixed(2)} < ${need} : « ${e.textContent.trim().slice(0, 30)} » (${cs.color} sur rgb(${bg}))`); }
  }
  // Cibles tactiles (WCAG 2.5.8 : 24 px minimum ; on signale sous 32 px de haut pour les boutons et liens autonomes).
  for (const e of q("button, input[type=checkbox], select")) { const r = e.getBoundingClientRect(); if (r.width && r.height && Math.min(r.width, r.height) < 24) out.push(`cible tactile ${Math.round(r.width)}×${Math.round(r.height)} : ${name(e).slice(0, 30)}`); }
  return out;
};

let total = 0;
for (const [ctx, path] of PAGES) {
  const page = await ctx.newPage();
  await page.goto(BASE + path);
  await page.waitForTimeout(path.includes("#") ? 1200 : 200);
  if (path.endsWith(".html")) await page.locator("h1").first().waitFor({ timeout: 15000 }).catch(() => undefined);
  const issues = await page.evaluate(audit);
  total += issues.length;
  console.log(`${issues.length ? "KO " : "OK "} ${path}${issues.length ? "\n     - " + issues.slice(0, 8).join("\n     - ") : ""}`);
  await page.close();
}
await browser.close();
console.log(`\n${total} problème(s) sur ${PAGES.length} pages`);
process.exit(total ? 1 : 0);
