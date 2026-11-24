// Connexion Google d'un NOUVEAU compte après « Tout accepter » : le cookie d'état doit conserver t = 2
// (conditions + données d'usage). Avant le correctif, t = 2 était relu comme 0 et le compte était refusé (« conditions »).
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./helpers/express-resolver.mjs", import.meta.url);
const { buildRoutes } = await import("../server/routes/index.js");
const g = await import("../server/lib/google-oauth.js");

test("cookie d'état : t = 0, 1 et 2 sont conservés tels quels, toute autre valeur retombe à 0", () => {
  const read = (t) => g.readStateCookie(`${g.STATE_COOKIE}=${g.packState({ s: "S", n: "/", t })}`).t;
  assert.equal(read(0), 0);
  assert.equal(read(1), 1);
  assert.equal(read(2), 2, "acceptation globale conservée");
  assert.equal(read(3), 0);
  assert.equal(read("2"), 0);
  assert.equal(read(undefined), 0);
});

function setup() {
  const calls = { login: [] };
  const accounts = {
    loginWithGoogle: async (profile, opts) => { calls.login.push({ profile, opts }); return { token: "T1", user: { id: "u1", email: profile.email, name: profile.name } }; },
  };
  const config = { production: false, publicUrl: "https://ika.example", google: { clientId: "cid", clientSecret: "sec", enabled: true, redirectUri: "https://ika.example/api/auth/google/callback" } };
  const router = buildRoutes({
    services: { accounts, db: {} }, config, limiter: { hit() {}, check() {}, record() {}, forget() {} }, logger: { info() {}, warn() {}, error() {} }, counters: {},
    requireUser: () => { throw new Error("non"); }, setSession: (res, t) => res.setHeader("Set-Cookie", `ika_session=${t}`), clearSession() {},
  });
  return { router, calls };
}

const withFakeGoogle = async (fn) => {
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith(g.TOKEN_URL)) return { ok: true, json: async () => ({ access_token: "AT" }) };
    if (String(url).startsWith(g.USERINFO_URL)) return { ok: true, json: async () => ({ sub: "g-2", email: "nouveau@example.ml", email_verified: true, name: "Nouveau Membre" }) };
    throw new Error("réseau inattendu " + url);
  };
  try { return await fn(); } finally { globalThis.fetch = real; }
};

test("parcours complet « Tout accepter » : /auth/google?terms=1&consent=all puis retour Google → conditions acceptées, données d'usage « all »", async () => {
  const { router, calls } = setup();
  const start = await router.call("GET", "/auth/google", { query: { terms: "1", consent: "all", next: "/annonces" } });
  const cookie = [].concat(start.headers["set-cookie"])[0].split(";")[0];
  const back = g.readStateCookie(cookie);
  assert.equal(back.t, 2, "le cookie porte l'acceptation globale");
  await withFakeGoogle(async () => {
    const out = await router.call("GET", "/auth/google/callback", { query: { code: "C", state: back.s }, headers: { cookie } });
    assert.equal(out.location, "/#/annonces", "pas de retour « conditions »");
  });
  assert.equal(calls.login.length, 1);
  assert.equal(calls.login[0].opts.acceptTerms, true);
  assert.equal(calls.login[0].opts.dataConsent, "all");
});

test("parcours « indispensable seulement » : conditions acceptées, données d'usage « essential »", async () => {
  const { router, calls } = setup();
  const start = await router.call("GET", "/auth/google", { query: { terms: "1", consent: "essential" } });
  const cookie = [].concat(start.headers["set-cookie"])[0].split(";")[0];
  const back = g.readStateCookie(cookie);
  assert.equal(back.t, 1);
  await withFakeGoogle(async () => {
    await router.call("GET", "/auth/google/callback", { query: { code: "C", state: back.s }, headers: { cookie } });
  });
  assert.equal(calls.login[0].opts.acceptTerms, true);
  assert.equal(calls.login[0].opts.dataConsent, "essential");
});

test("application Android : l'acceptation globale est aussi conservée dans le cookie d'état", async () => {
  const { router } = setup();
  const start = await router.call("GET", "/auth/google", { query: { terms: "1", consent: "all", app: "1" } });
  const back = g.readStateCookie([].concat(start.headers["set-cookie"])[0].split(";")[0]);
  assert.equal(back.t, 2);
  assert.equal(back.a, 1);
});
