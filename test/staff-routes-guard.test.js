// BUG-008 : chaque route /staff/* doit refuser l'accès sans autorisation.
// 1) Dynamique : sans utilisateur connecté, aucune route /staff/* n'atteint un service (requireUser refuse d'abord, 401).
// 2) Statique : chaque route /staff/* a une garde de rôle, soit dans la route, soit au début de la fonction de service appelée.
// Express est remplacé par le mini routeur de test ; aucun accès à la base.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";

register("./helpers/express-resolver.mjs", import.meta.url);
const { buildRoutes } = await import("../server/routes/index.js");
const { unauthorized } = await import("../server/lib/errors.js");

// --- 1. Dynamique ---------------------------------------------------------------------------
const reached = [];
const serviceProxy = (name) => new Proxy({}, {
  get: (_, method) => (method === "then" || typeof method === "symbol") ? undefined : (...args) => { reached.push(`${name}.${String(method)}`); throw new Error(`ATTEINT:${name}.${String(method)}`); },
});
const services = new Proxy({}, { get: (_, name) => (name === "then" || typeof name === "symbol") ? undefined : serviceProxy(String(name)) });
const requireUser = (req) => { if (!req.user?.id) throw unauthorized("Connexion requise."); return req.user.id; };
const router = buildRoutes({ services, config: {}, limiter: () => {}, logger: { info() {}, error() {}, warn() {} }, counters: {}, requireUser, setSession() {}, clearSession() {} });
const staffRoutes = router.routes.filter((r) => r.path.startsWith("/staff/"));

test("il existe des routes /staff/* à contrôler", () => {
  assert.ok(staffRoutes.length >= 100, `routes /staff/* trouvées : ${staffRoutes.length}`);
});

test("sans connexion, aucune route /staff/* n'atteint un service : toutes répondent 401", async () => {
  const problems = [];
  for (const r of staffRoutes) {
    reached.length = 0;
    const url = r.path.replace(/:([A-Za-z]+)/g, "x");
    const out = await router.call(r.method, url, { user: undefined, body: {}, query: {} });
    const status = out.error?.status ?? out.status;
    if (reached.length) problems.push(`${r.method} ${r.path} : service atteint sans connexion (${reached.join(", ")})`);
    else if (status !== 401) problems.push(`${r.method} ${r.path} : statut ${status} au lieu de 401`);
  }
  assert.deepEqual(problems, []);
});

// --- 2. Statique ----------------------------------------------------------------------------
const GUARD = /\b(requireStaff|requirePermission|requireSuperadmin|requireOwner\w*|requireSuper\w*|assertStaff|requireRole|requireAdmin|requireModerator|guard|canAccess)\s*\(/;
const routesText = readFileSync(new URL("../server/routes/index.js", import.meta.url), "utf8").split("\n");
const starts = []; routesText.forEach((l, i) => { if (/^\s*router\.(get|post|put|patch|delete)\(\s*["'`]/.test(l)) starts.push(i); });
const staffBlocks = [];
starts.forEach((s, k) => {
  const text = routesText.slice(s, starts[k + 1] ?? routesText.length).join("\n");
  const m = /router\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)/.exec(text);
  if (m && m[2].startsWith("/staff/")) staffBlocks.push({ method: m[1].toUpperCase(), path: m[2], text });
});
const servicesDir = new URL("../server/services/", import.meta.url);
const serviceFiles = Object.fromEntries(readdirSync(servicesDir).filter((f) => f.endsWith(".js")).map((f) => [f.replace(/\.js$/, ""), readFileSync(new URL(f, servicesDir), "utf8").split("\n")]));
const kebab = (name) => name.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
// Corps exact de chaque définition « nom(...) { ... } » : jusqu'à l'accolade fermante de même indentation.
function bodiesOf(lines, name) {
  const re = new RegExp(`^(\\s*)(async\\s+)?(function\\s+)?${name}\\s*\\(|^(\\s*)${name}\\s*:\\s*(async\\s*)?\\(|^(\\s*)(const|let)\\s+${name}\\s*=\\s*(async\\s*)?\\(`);
  const out = [];
  lines.forEach((l, i) => {
    const m = re.exec(l);
    if (!m || /^\s*(\/\/|\*)/.test(l)) return;
    const indent = (m[1] ?? m[4] ?? m[6] ?? "").length;
    const body = [l];
    if (!/\}\s*[,;)]*\s*$/.test(l) || /\{\s*$/.test(l)) {
      for (let j = i + 1; j < lines.length; j++) { body.push(lines[j]); if (new RegExp(`^\\s{0,${indent}}\\}`).test(lines[j])) break; }
    }
    out.push(body);
  });
  return out;
}
// La garde doit figurer au début du corps (avant tout accès aux données) : 8 premières lignes,
// ou y être déléguée à une autre fonction du même service (« this.autre(userId) »), elle-même gardée.
function bodyIsGuarded(lines, fn, depth = 0) {
  const bodies = bodiesOf(lines, fn);
  return bodies.length > 0 && bodies.every((b) => {
    const head = b.slice(0, 8).join("\n");
    if (GUARD.test(head)) return true;
    const d = /\bthis\.(\w+)\(\s*(userId|actorId|staffId)/.exec(head);
    return depth < 2 && d != null && bodyIsGuarded(lines, d[1], depth + 1);
  });
}
function serviceFunctionHasGuard(serviceVar, fn) {
  const file = serviceFiles[kebab(serviceVar)] ?? serviceFiles[serviceVar];
  if (file) return bodyIsGuarded(file, fn);
  return Object.values(serviceFiles).some((lines) => bodiesOf(lines, fn).length > 0) && Object.values(serviceFiles).every((lines) => bodiesOf(lines, fn).length === 0 || bodyIsGuarded(lines, fn));
}

test("chaque route /staff/* a une garde de rôle (dans la route ou dans le service appelé)", () => {
  assert.ok(staffBlocks.length >= 100);
  const unguarded = [];
  for (const b of staffBlocks) {
    if (GUARD.test(b.text)) continue;
    const calls = [...b.text.matchAll(/\b([a-zA-Z]+)\.([a-zA-Z]+)\(\s*(requireUser\(req\)|req\.user|staffId|userId|actorId)/g)];
    if (!calls.length || !calls.some((c) => serviceFunctionHasGuard(c[1], c[2]))) unguarded.push(`${b.method} ${b.path}`);
  }
  assert.deepEqual(unguarded, [], "routes /staff/* sans garde de rôle détectée");
});
