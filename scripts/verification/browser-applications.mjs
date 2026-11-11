import { createRequire } from "node:module";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:18090", SH = process.argv[2];
let fails = 0; const ok = (n, c, d = "") => { console.log(`${c ? "OK   " : "ECHEC"} ${n}${d ? " — " + d : ""}`); if (!c) fails++; };
const stamp = Date.now();
const browser = await chromium.launch();
let ip = 0;
const ctx = async () => browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { "X-Forwarded-For": `10.1.0.${++ip}` } });
const post = (c, path, body) => c.request.post(BASE + "/api" + path, { data: body });
const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n%test\n"), Buffer.alloc(400, 7)]);

// Compte agence : inscription par l'API, le reste par l'interface
const c1 = await ctx(); const p1 = await c1.newPage(); const errs = [];
p1.on("pageerror", (e) => errs.push(e.message)); p1.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
let r = await post(c1, "/auth/register", { name: "Agence Navigateur", email: `nav${stamp}@x.ml`, password: "motdepasse123", acceptTerms: true });
ok("inscription agence", r.ok(), String(r.status()));
await p1.goto(BASE + "/#/devenir-annonceur?type=agence"); await p1.waitForSelector("form");
await p1.fill('input[name=fullName]', "Awa Traoré"); await p1.fill('input[name=phone]', "70112233");
await p1.fill('input[name=city]', "Bamako"); await p1.fill('input[name=agencyName]', "Agence Navigateur");
await p1.fill('textarea[name=description]', "Vente et location");
await p1.setInputFiles('input[name=rccm]', { name: "rccm.pdf", mimeType: "application/pdf", buffer: pdf });
await p1.setInputFiles('input[name=doc_identity]', { name: "cni.pdf", mimeType: "application/pdf", buffer: pdf });
await p1.setInputFiles('input[name=doc_other]', { name: "autre.pdf", mimeType: "application/pdf", buffer: pdf });
await p1.screenshot({ path: `${SH}/1-formulaire.png`, fullPage: true });
await p1.getByRole('button', { name: 'Envoyer la demande' }).click(); await p1.waitForTimeout(1500);
await p1.screenshot({ path: `${SH}/2-apres-envoi.png` });
const mine = await (await c1.request.get(BASE + "/api/me/advertiser-applications")).json();
ok("demande créée avec 2 pièces jointes", mine.length === 1 && mine[0].documents_count === 2, JSON.stringify(mine[0]));

// Équipe : promotion en base puis lecture des pièces dans l'écran
const { execSync } = await import("node:child_process");
const psql = (q) => execSync(`psql -h /tmp -p 55432 -U postgres -d ikaso -tA -c "${q}"`).toString().trim();
const c2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { "X-Forwarded-For": "10.1.0.99" } }); const p2 = await c2.newPage(); p2.on("pageerror", (e) => errs.push("admin: " + e.message));
r = await post(c2, "/auth/register", { name: "Modo Navigateur", email: `modnav${stamp}@x.ml`, password: "motdepasse123", acceptTerms: true });
const modId = (await r.json()).user.id;
await post(c2, "/me", {}).catch(() => {});
await c2.request.get(BASE + "/api/me");
psql(`update ika_profiles set staff_role='ADMIN' where user_id='${modId}'`);
const auditBefore = Number(psql("select count(*) from ika_audit where action='VIEW_APPLICATION_DOCUMENT'"));
await p2.goto(BASE + "/admin.html"); await p2.waitForTimeout(2500);
await p2.screenshot({ path: `${SH}/3-admin.png` });
const tab = p2.getByRole("tab", { name: "Demandes annonceurs" });
if (await tab.count()) { await tab.click().catch(() => {}); await p2.waitForTimeout(1000); }
const btn = p2.getByRole("button", { name: /Voir : pièce d'identité/ });
ok("bouton « Voir : pièce d'identité » affiché", (await btn.count()) >= 1);
if (await btn.count()) {
  const [popup] = await Promise.all([p2.context().waitForEvent("page", { timeout: 5000 }).catch(() => null), btn.first().click()]);
  ok("la pièce s'ouvre dans un nouvel onglet", !!popup, popup ? popup.url().slice(0, 20) : "");
  await p2.screenshot({ path: `${SH}/4-apres-clic.png` });
}
ok("lecture journalisée", Number(psql("select count(*) from ika_audit where action='VIEW_APPLICATION_DOCUMENT'")) === auditBefore + 1);

// --- Justificatifs d'agence branchés dans la demande ---
const rbtn = p2.getByRole("button", { name: "Voir : RCCM de l'agence" });
ok("bouton « Voir : RCCM de l'agence » affiché", (await rbtn.count()) === 1);
const auditP = Number(psql("select count(*) from ika_audit where action='VIEW_PROOF'"));
const [pop2] = await Promise.all([p2.context().waitForEvent("page", { timeout: 5000 }).catch(() => null), rbtn.click()]);
ok("le RCCM s'ouvre dans un nouvel onglet", !!pop2);
ok("lecture du RCCM journalisée", Number(psql("select count(*) from ika_audit where action='VIEW_PROOF'")) === auditP + 1);
const answers = ["Greffe de Bamako, RCCM MA.BKO.2020.B.1234", "Agence Navigateur"];
p2.on("dialog", (d) => d.accept(answers.shift() ?? ""));
await p2.getByRole("button", { name: "RCCM contrôlé : accepter" }).click(); await p2.waitForTimeout(1500);
ok("RCCM accepté depuis la demande : badge agence donné", psql(`select agency_verified_at is not null from ika_profiles where user_id=(select user_id from ika_advertiser_applications limit 1)`) === "t");
ok("la demande reste en attente (RCCM facultatif)", psql("select status from ika_advertiser_applications limit 1") === "PENDING");
// Demande d'infos puis ajout de pièce par le titulaire dans l'interface
const appId = mine[0].id;
r = await c2.request.post(`${BASE}/api/staff/advertiser-applications/${appId}/decide`, { data: { action: "NEED_INFO", note: "Joindre les statuts" } });
ok("demande d'infos", r.ok(), String(r.status()));
await p1.goto(BASE + "/#/devenir-annonceur"); await p1.reload(); await p1.waitForTimeout(1500);
ok("message de l'équipe affiché au titulaire", (await p1.getByText("Joindre les statuts").count()) === 1);
await p1.setInputFiles('input[aria-label="Ajouter une pièce à la demande"]', { name: "statuts.pdf", mimeType: "application/pdf", buffer: pdf });
await p1.waitForTimeout(1800);
ok("pièce ajoutée depuis l'écran (3 sur 5)", Number(psql(`select jsonb_array_length(documents) from ika_advertiser_applications where id='${appId}'`)) === 3);

const before = Number(psql(`select count(*) from ika_proofs where kind='AGENCE' and owner_id=(select user_id from ika_advertiser_applications limit 1)`));
await p1.setInputFiles('input[aria-label="Envoyer le RCCM de l\'agence"]', { name: "rccm2.pdf", mimeType: "application/pdf", buffer: pdf });
await p1.waitForTimeout(1500);
ok("RCCM renvoyé depuis la demande en cours", Number(psql(`select count(*) from ika_proofs where kind='AGENCE' and owner_id=(select user_id from ika_advertiser_applications limit 1)`)) === before + 1);
// Approbation puis renouvellement
await c2.request.post(`${BASE}/api/staff/advertiser-applications/${appId}/decide`, { data: { action: "APPROVE" } });
await p1.goto(BASE + "/#/devenir-annonceur"); await p1.reload(); await p1.waitForTimeout(1500);
await p1.screenshot({ path: `${SH}/5-conservation.png` });
ok("avis de conservation affiché", (await p1.getByText(/sont conservées jusqu'au/).count()) === 1);
await p1.getByRole("button", { name: "Conserver une année de plus" }).click(); await p1.waitForTimeout(1500);
ok("renouvellement par l'écran", Number(psql(`select count(*) from ika_advertiser_applications where id='${appId}' and documents_expire_at > now() + interval '364 days'`)) === 1);
ok("aucune erreur JavaScript", errs.length === 0, errs.slice(0, 3).join(" | "));
console.log(fails ? `${fails} ÉCHEC(S)` : "TOUT OK"); await browser.close(); process.exit(fails ? 1 : 0);
