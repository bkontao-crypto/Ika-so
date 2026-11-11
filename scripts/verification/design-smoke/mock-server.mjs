// Serveur de test simulé : sert public/ et répond aux appels /api avec des données factices (aucune base réelle).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../public");
const PORT = Number(process.argv[2] || 4173);
const ROLE = process.argv[3]; // "user" = compte standard ; "admin" = administrateur (gestion des partenaires)
const AS_USER = ROLE === "user" || ROLE === "admin";
const log = [];
const L = (id, title, category, tx, price, hood, img, featured, lat, lng, extra = {}) => ({ id, title, category, transactionType: tx, price, neighborhood: hood, imageUrl: img, featured, latitude: lat, longitude: lng, bedrooms: category === "Terrain" ? 0 : 3, surfaceLabel: "300 m²", ownerName: "Fatoumata Diarra", agencyName: null, agencyVerified: false, ...extra });
const ALL = [
  L("l1", "Villa moderne avec piscine", "Maison", "Vente", 150000000, "ACI 2000", "/media/villa-badala.jpg", true, 12.616, -8.024, { agencyName: "Mali Habitat", agencyVerified: true }),
  L("l2", "Appartement meublé F4", "Appartement", "Location", 350000, "Badalabougou", "/media/appart-hamdallaye.jpg", true, 12.612, -7.986),
  L("l3", "Terrain constructible 500 m²", "Terrain", "Vente", 25000000, "Yirimadio", "/media/terrain-yiri.jpg", false, 12.608, -7.958),
  L("l4", "Terrain ACI", "Terrain", "Vente", 40000000, "ACI 2000", "/media/terrain-aci.jpg", false, 12.617, -8.02),
  L("l5", "Studio Hamdallaye", "Studio", "Location", 120000, "Hamdallaye", "/media/appart-hamdallaye.jpg", false, 12.649, -8.016),
  L("l6", "Maison Korofina", "Maison", "Vente", 60000000, "Korofina", "/media/villa-badala.jpg", false, 12.662, -7.992),
  L("l7", "Appartement Hamdallaye", "Appartement", "Location", 200000, "Hamdallaye", "/media/appart-hamdallaye.jpg", false, 12.65, -8.01),
];

// Partenaires (page « Partenaires ») : liste en mémoire, mêmes formes de réponse que l'API réelle.
const CATS = ["Agence immobilière", "Promoteur", "Notaire et juridique", "Banque et financement", "Construction et matériaux", "Géomètre et topographie", "Assurance", "Déménagement et services", "Autre"];
let PARTNERS = [{ id: "par-1", name: "Cabinet Keïta & Associés", category: "Notaire et juridique", description: "Vérification de titres fonciers, rédaction d'actes de vente et accompagnement des acheteurs.", websiteUrl: "https://www.exemple.ml/", logoUrl: null, status: "ACTIVE" }];
const partnerView = (staff) => ({ partners: PARTNERS.filter((x) => staff || x.status === "ACTIVE"), categories: CATS });

// État modifiable du profil (tests de la page « Mon profil »).
const P = { name: "Moussa Diallo", city: "", bio: "", showPhone: false, showWhatsapp: false, coverUrl: null, avatarUrl: null, analytics: false, posts: [] };
const MINE = [
  { id: "m1", title: "Studio meublé tout équipé", category: "Studio", transactionType: "Location", price: 150000, status: "PUBLISHED", declaredDocument: null, imageUrl: "/media/appart-hamdallaye.jpg", neighborhood: "ACI 2000" },
  { id: "m2", title: "Terrain viabilisé 800 m²", category: "Terrain", transactionType: "Vente", price: 15000000, status: "PENDING", declaredDocument: "Lettre d'attribution", imageUrl: "/media/terrain-aci.jpg", neighborhood: "Yirimadio" },
];
const readBody = (req, cb) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { let j = {}; try { j = JSON.parse(b || "{}"); } catch {} cb(j); }); };
const json = (res, data, code = 200) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".webmanifest": "application/json" };
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/__log") return json(res, log);
  if (u.pathname.startsWith("/api/")) {
    const p = u.pathname.slice(4);
    log.push(`${req.method} ${p}${u.search}`);
    if (p === "/partners") return json(res, partnerView(false));
    if (ROLE === "admin" && p.startsWith("/staff/partner")) return readBody(req, (b) => {
      if (p === "/staff/partners" && req.method === "GET") return json(res, partnerView(true));
      if (p === "/staff/partners" && req.method === "POST") { if (!b.name || String(b.name).trim().length < 2) return json(res, { error: "Le nom du partenaire est obligatoire (2 à 80 caractères)." }, 400); const n = { id: "par-" + (PARTNERS.length + 1), status: "ACTIVE", description: "", websiteUrl: null, logoUrl: null, ...b }; PARTNERS.push(n); return json(res, n, 201); }
      if (p === "/staff/partner-logo") return json(res, { logoUrl: "/media/terrain-aci.jpg" }, 201);
      const m = /^\/staff\/partners\/([^/]+)(\/(status|delete))?$/.exec(p);
      if (m) { const i = PARTNERS.findIndex((x) => x.id === m[1]); if (i < 0) return json(res, { error: "Partenaire introuvable." }, 404);
        if (m[3] === "delete") { PARTNERS.splice(i, 1); return json(res, { ok: true }); }
        if (m[3] === "status") { PARTNERS[i].status = b.status; return json(res, PARTNERS[i]); }
        PARTNERS[i] = { ...PARTNERS[i], ...b }; return json(res, PARTNERS[i]); }
      return json(res, {});
    });
    if (p === "/me") return json(res, AS_USER ? { user: { id: "u1", name: P.name, email: "awa@example.ml" }, meta: { favoriteIds: ["l1"], displayRole: "Propriétaire direct", fullName: P.name, phoneVerified: true, accountStatus: "ACTIVE", staffRole: ROLE === "admin" ? "ADMIN" : "USER" } } : { user: null, meta: null });
    if (AS_USER && (p.startsWith("/me/") || p.startsWith("/advertisers/u1"))) {
      const pp = () => ({ role: "Propriétaire direct", agencyVerified: false, allowed: ["bio", "city", "showPhone", "showWhatsapp"], limits: { bio: 1500, address: 200, hours: 120, zones: 8, city: 60 }, hasPhone: true,
        profile: { bio: P.bio, city: P.city, foundedYear: "", zones: [], address: "", hours: "", showPhone: P.showPhone, showWhatsapp: P.showWhatsapp, coverUrl: P.coverUrl, avatarUrl: P.avatarUrl, imagesHidden: false } });
      if (p === "/me/unread") return json(res, { notifications: 1, threads: 2, visits: 0 });
      return readBody(req, (b) => {
        if (p === "/me/public-profile" && req.method === "GET") return json(res, pp());
        if (p === "/me/public-profile" && req.method === "PUT") { for (const k of ["bio", "city", "showPhone", "showWhatsapp"]) if (k in b) P[k] = b[k]; return json(res, pp()); }
        if (p === "/me/public-profile/image") { P[b.kind === "cover" ? "coverUrl" : "avatarUrl"] = b.kind === "cover" ? "/media/villa-badala.jpg" : "/media/terrain-yiri.jpg"; return json(res, { url: "/x" }); }
        if (p === "/me/public-profile/image/delete") { P[b.kind === "cover" ? "coverUrl" : "avatarUrl"] = null; return json(res, {}); }
        if (p === "/me/identity") { P.name = String(b.fullName || "").trim(); return json(res, { fullName: P.name }); }
        if (p === "/advertisers/u1") return json(res, { memberSince: "2025-03-10T10:00:00Z", rating: { average: 0, count: 0 }, publications: P.posts, trust: {}, followers: 0 });
        if (p === "/advertisers/u1/reviews") return json(res, []);
        if (p === "/me/listings") return json(res, MINE);
        if (p === "/me/score") return json(res, { score: 71, parts: { trust: 60, visibility: 20, loyalty: 30, reactivity: 50 }, trust: {}, rating: { average: 0, count: 0 } });
        if (p === "/me/analytics-consent") { if (req.method === "PUT") P.analytics = b.accepted === true; return json(res, { accepted: P.analytics }); }
        if (p === "/me/publications" && req.method === "POST") { P.posts.unshift({ id: "p" + P.posts.length, content: b.content, createdAt: new Date().toISOString() }); return json(res, { id: "p" }, 201); }
        if (p === "/me/proofs") return json(res, []);
        if (p === "/me/center/access") return json(res, { premium: false, certified: false, eligible: false });
        if (p === "/me/notify-prefs") return json(res, { emailAvailable: false, smsAvailable: false });
        if (p === "/me/newsletter") return json(res, { subscribed: false });
        return json(res, {});
      });
    }
    if (p === "/me/unread") return json(res, { notifications: 1, threads: 2, visits: 0 });
    if (p === "/homepage-settings") return json(res, {});
    if (p === "/listings") {
      const q = u.searchParams; let r = ALL;
      if (q.get("transaction")) r = r.filter((i) => i.transactionType === q.get("transaction"));
      if (q.get("category")) r = r.filter((i) => i.category === q.get("category"));
      if (q.get("q")) r = r.filter((i) => (i.neighborhood + " " + i.title).toLowerCase().includes(q.get("q").toLowerCase()));
      if (q.get("maxPrice")) r = r.filter((i) => i.price <= Number(q.get("maxPrice")));
      return json(res, r);
    }
    if (p === "/me/geo") return json(res, { items: [], stats: { located: 0, delimitedPlots: 0, housesLocated: 0, totalAreaM2: 0 } });
    if (p === "/e" || p === "/client-error") return json(res, {});
    return json(res, {});
  }
  let f = path.join(ROOT, u.pathname === "/" ? "index.html" : decodeURIComponent(u.pathname));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("404"); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log("mock prêt sur", PORT));
