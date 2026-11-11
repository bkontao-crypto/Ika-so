// En-têtes de sécurité, politique de contenu (CSP), protection CSRF par origine, cookie de session.
import test from "node:test";
import assert from "node:assert/strict";
import { contentSecurityPolicy, securityHeaders, sameOriginOnly, sessionCookie, clearedSessionCookie } from "../server/lib/web.js";

const run = (mw, req) => new Promise((resolve) => {
  const headers = {};
  const res = { setHeader: (k, v) => { headers[k] = v; } };
  const full = {
    method: "POST", originalUrl: "/api/x", headers: {},
    get(name) { return this.headers[name.toLowerCase()]; },
    is(type) { return /json/.test(type) && /application\/json/i.test(String(this.headers["content-type"] ?? "")); },
    ...req,
  };
  full.headers = Object.fromEntries(Object.entries(req.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  mw(full, res, (error) => resolve({ error, headers }));
});

test("CSP sans Mapbox : aucune ressource externe", () => {
  const csp = contentSecurityPolicy({});
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.ok(!/https?:/.test(csp));
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
});

test("CSP avec jeton Mapbox : seules les adresses Mapbox nécessaires, script-src inchangé", () => {
  const csp = contentSecurityPolicy({ mapbox: { token: "pk.aaaaaaaaaa.bbbbbbbbbb" } });
  assert.match(csp, /connect-src 'self' https:\/\/api\.mapbox\.com https:\/\/events\.mapbox\.com/);
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.ok(!/unsafe-inline|unsafe-eval/.test(csp));
});

test("en-têtes : HSTS seulement en production", async () => {
  const dev = await run(securityHeaders({ production: false }), { method: "GET" });
  const prod = await run(securityHeaders({ production: true }), { method: "GET" });
  assert.equal(dev.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(dev.headers["X-Frame-Options"], "DENY");
  assert.equal(dev.headers["Strict-Transport-Security"], undefined);
  assert.match(prod.headers["Strict-Transport-Security"], /max-age=31536000/);
});

test("CSRF : lecture libre, écriture refusée depuis une autre origine", async () => {
  assert.equal((await run(sameOriginOnly, { method: "GET", headers: { origin: "https://evil.example" } })).error, undefined);
  const bad = await run(sameOriginOnly, { headers: { origin: "https://evil.example", host: "ikaso.example", "content-type": "application/json", "content-length": "2" } });
  assert.equal(bad.error?.status, 403);
  const garbled = await run(sameOriginOnly, { headers: { origin: "pas une adresse", host: "ikaso.example" } });
  assert.equal(garbled.error?.status, 403);
});

test("CSRF : même origine + JSON acceptés ; corps non JSON refusé", async () => {
  const ok = await run(sameOriginOnly, { headers: { origin: "https://ikaso.example", host: "ikaso.example", "content-type": "application/json", "content-length": "2" } });
  assert.equal(ok.error, undefined);
  const form = await run(sameOriginOnly, { headers: { host: "ikaso.example", "content-type": "text/plain", "content-length": "5" } });
  assert.equal(form.error?.status, 403);
  const empty = await run(sameOriginOnly, { headers: { host: "ikaso.example", "content-length": "0" } });
  assert.equal(empty.error, undefined, "un POST sans corps (déconnexion) reste possible");
});

test("CSRF : seule exception = notification de paiement en formulaire, sans Origin", async () => {
  const hook = await run(sameOriginOnly, { originalUrl: "/api/payments/webhook?x=1", headers: { host: "ikaso.example", "content-type": "application/x-www-form-urlencoded", "content-length": "20" } });
  assert.equal(hook.error, undefined);
  const other = await run(sameOriginOnly, { originalUrl: "/api/me/delete", headers: { host: "ikaso.example", "content-type": "application/x-www-form-urlencoded", "content-length": "20" } });
  assert.equal(other.error?.status, 403);
  const withOrigin = await run(sameOriginOnly, { originalUrl: "/api/payments/webhook", headers: { origin: "https://evil.example", host: "ikaso.example", "content-type": "application/x-www-form-urlencoded", "content-length": "20" } });
  assert.equal(withOrigin.error?.status, 403);
});

test("cookie de session : HttpOnly, SameSite=Lax, Secure seulement en production", () => {
  const dev = sessionCookie("tok en/1", { production: false });
  const prod = sessionCookie("tok", { production: true });
  assert.match(dev, /^ika_session=tok%20en%2F1;/);
  assert.match(dev, /HttpOnly/);
  assert.match(dev, /SameSite=Lax/);
  assert.ok(!/Secure/.test(dev));
  assert.match(prod, /Secure/);
  assert.match(clearedSessionCookie(), /Max-Age=0/);
});
