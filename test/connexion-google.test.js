// Connexion avec Google : fonctions pures, routes (faux Google, sans réseau), et règles de liaison des comptes sur une vraie base (si DATABASE_URL_TEST).
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./helpers/express-resolver.mjs", import.meta.url);
const { buildRoutes } = await import("../server/routes/index.js");
const { getConfig } = await import("../server/config.js");
const g = await import("../server/lib/google-oauth.js");
const { conflict, badRequest, forbidden } = await import("../server/lib/errors.js");

test("authorizationUrl : fournisseur Google, code, portée openid/email/profile, état transmis", () => {
  const u = new URL(g.authorizationUrl({ clientId: "cid", redirectUri: "https://ika.test/api/auth/google/callback", state: "etat-1" }));
  assert.equal(u.origin + u.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(u.searchParams.get("client_id"), "cid");
  assert.equal(u.searchParams.get("redirect_uri"), "https://ika.test/api/auth/google/callback");
  assert.equal(u.searchParams.get("response_type"), "code");
  assert.equal(u.searchParams.get("scope"), "openid email profile");
  assert.equal(u.searchParams.get("state"), "etat-1");
});

test("sameState : comparaison exacte, refus des états vides ou de longueur différente", () => {
  assert.equal(g.sameState("abc", "abc"), true);
  assert.equal(g.sameState("abc", "abd"), false);
  assert.equal(g.sameState("abc", "ab"), false);
  assert.equal(g.sameState("", ""), false);
  assert.equal(g.sameState(undefined, "x"), false);
  assert.ok(g.newState().length >= 40 && g.newState() !== g.newState());
});

test("état en cookie : aller-retour, page d'arrivée sûre uniquement", () => {
  const cookie = `autre=1; ${g.STATE_COOKIE}=${g.packState({ s: "S1", n: "/annonces", t: 1 })}`;
  assert.deepEqual(g.readStateCookie(cookie), { s: "S1", n: "/annonces", t: 1 });
  assert.equal(g.readStateCookie("rien=1"), null);
  assert.equal(g.readStateCookie(`${g.STATE_COOKIE}=pas-du-json`), null);
  for (const bad of ["//evil.example", "https://evil.example", "/\\evil", "annonces"]) assert.equal(g.safeNext(bad), "/", bad);
  assert.equal(g.safeNext("/profil"), "/profil");
  const cookieHeader = g.stateCookie("x", { production: true });
  assert.match(cookieHeader, /Path=\/api\/auth\/google; HttpOnly; SameSite=Lax; Max-Age=600; Secure/);
});

test("fetchProfile : e-mail non confirmé ou profil incomplet refusés", async () => {
  const ok = async () => ({ ok: true, json: async () => ({ sub: "123", email: "Ali@Example.ML", email_verified: true, name: "Ali" }) });
  assert.deepEqual(await g.fetchProfile("tok", ok), { sub: "123", email: "ali@example.ml", name: "Ali" });
  const notVerified = async () => ({ ok: true, json: async () => ({ sub: "1", email: "a@b.c", email_verified: false }) });
  await assert.rejects(g.fetchProfile("tok", notVerified), /non confirmé/);
  const noSub = async () => ({ ok: false, json: async () => ({}) });
  await assert.rejects(g.fetchProfile("tok", noSub), /illisible/);
});

test("exchangeCode : envoie le secret côté serveur seulement, refuse une réponse sans jeton", async () => {
  let sent;
  const good = async (url, opts) => { sent = { url, body: opts.body.toString() }; return { ok: true, json: async () => ({ access_token: "AT" }) }; };
  assert.equal(await g.exchangeCode({ code: "C", clientId: "cid", clientSecret: "sec", redirectUri: "https://r", fetchImpl: good }), "AT");
  assert.equal(sent.url, g.TOKEN_URL);
  assert.match(sent.body, /client_secret=sec/);
  assert.match(sent.body, /grant_type=authorization_code/);
  const bad = async () => ({ ok: false, json: async () => ({ error: "invalid_grant" }) });
  await assert.rejects(g.exchangeCode({ code: "C", clientId: "c", clientSecret: "s", redirectUri: "r", fetchImpl: bad }), /refusé/);
});

test("configuration Google : activée seulement avec identifiant, secret et adresse https", () => {
  const on = getConfig({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "sec", PUBLIC_URL: "https://ika.example/" }).google;
  assert.equal(on.enabled, true);
  assert.equal(on.redirectUri, "https://ika.example/api/auth/google/callback");
  assert.equal(getConfig({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "sec" }).google.enabled, false, "sans PUBLIC_URL");
  assert.equal(getConfig({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "sec", PUBLIC_URL: "http://x" }).google.enabled, false, "adresse non https");
  assert.equal(getConfig({ GOOGLE_CLIENT_ID: "id", PUBLIC_URL: "https://x" }).google.enabled, false, "sans secret");
});

/** Routes avec un faux service de comptes et un faux Google (aucun appel réseau réel). */
function setup({ enabled = true, login } = {}) {
  const calls = { login: [], sessions: [] };
  const accounts = { loginWithGoogle: async (profile, opts) => { calls.login.push({ profile, opts }); if (login) return login(profile, opts); return { token: "T1", user: { id: "u1", email: profile.email, name: profile.name } }; } };
  const config = { production: false, publicUrl: "https://ika.example", google: enabled ? { clientId: "cid", clientSecret: "sec", enabled: true, redirectUri: "https://ika.example/api/auth/google/callback" } : { enabled: false } };
  const router = buildRoutes({
    services: { accounts, db: {} }, config, limiter: { hit() {}, check() {}, record() {}, forget() {} }, logger: { info() {}, warn() {}, error() {} }, counters: {},
    requireUser: () => { throw new Error("non"); }, setSession: (res, t) => { calls.sessions.push(t); res.setHeader("Set-Cookie", `ika_session=${t}`); }, clearSession() {},
  });
  return { router, calls };
}
const withFakeGoogle = async (fn) => {
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith(g.TOKEN_URL)) return { ok: true, json: async () => ({ access_token: "AT" }) };
    if (String(url).startsWith(g.USERINFO_URL)) return { ok: true, json: async () => ({ sub: "g-1", email: "ali@example.ml", email_verified: true, name: "Ali Traoré" }) };
    throw new Error("réseau inattendu " + url);
  };
  try { return await fn(); } finally { globalThis.fetch = real; }
};

test("/auth/google : désactivé → retour à la connexion ; sans acceptation des conditions → refusé", async () => {
  const off = setup({ enabled: false });
  const a = await off.router.call("GET", "/auth/google", { query: { terms: "1" } });
  assert.equal(a.location, "/#/connexion?google=indisponible");
  const on = setup();
  const b = await on.router.call("GET", "/auth/google", { query: {} });
  assert.equal(b.location, "/#/connexion?google=conditions");
  assert.equal(b.headers["set-cookie"], undefined, "aucun cookie d'état sans acceptation");
});

test("/auth/google : redirige vers Google avec un état et un cookie limité au chemin de retour", async () => {
  const { router } = setup();
  const out = await router.call("GET", "/auth/google", { query: { terms: "1", next: "/annonces" } });
  assert.equal(out.status, 302);
  const u = new URL(out.location);
  assert.equal(u.origin, "https://accounts.google.com");
  const state = u.searchParams.get("state");
  assert.ok(state && state.length >= 40);
  const cookie = [].concat(out.headers["set-cookie"])[0];
  assert.match(cookie, /^ika_oauth=/);
  assert.match(cookie, /Path=\/api\/auth\/google/);
  const back = g.readStateCookie(cookie.split(";")[0]);
  assert.equal(back.s, state);
  assert.equal(back.n, "/annonces");
  assert.equal(back.t, 1);
});

test("/auth/google/callback : état absent ou faux → refus, aucun compte touché", async () => {
  const { router, calls } = setup();
  const noCookie = await router.call("GET", "/auth/google/callback", { query: { code: "C", state: "x" } });
  assert.equal(noCookie.location, "/#/connexion?google=etat");
  const cookie = `ika_oauth=${g.packState({ s: "BON", n: "/", t: 1 })}`;
  const wrong = await router.call("GET", "/auth/google/callback", { query: { code: "C", state: "MAUVAIS" }, headers: { cookie } });
  assert.equal(wrong.location, "/#/connexion?google=etat");
  assert.equal(calls.login.length, 0);
});

test("/auth/google/callback : Google annule → « refus » ; succès → session posée, cookie d'état effacé, retour à la page demandée", async () => {
  const { router, calls } = setup();
  const cookie = `ika_oauth=${g.packState({ s: "BON", n: "/annonces", t: 1 })}`;
  const refused = await router.call("GET", "/auth/google/callback", { query: { error: "access_denied", state: "BON" }, headers: { cookie } });
  assert.equal(refused.location, "/#/connexion?google=refus");
  await withFakeGoogle(async () => {
    const ok = await router.call("GET", "/auth/google/callback", { query: { code: "C", state: "BON" }, headers: { cookie } });
    assert.equal(ok.location, "/#/annonces");
    const set = [].concat(ok.headers["set-cookie"]);
    assert.ok(set.some((c) => c === "ika_session=T1"), "session posée");
    assert.ok(set.some((c) => /^ika_oauth=;.*Max-Age=0/.test(c)), "cookie d'état effacé");
  });
  assert.equal(calls.login.length, 1);
  assert.equal(calls.login[0].opts.acceptTerms, true);
  assert.equal(calls.login[0].profile.sub, "g-1");
});

test("/auth/google/callback : refus métier → code d'erreur lisible, pas de session", async () => {
  const cases = [[conflict("x"), "compte-existant"], [badRequest("x"), "conditions"], [forbidden("x"), "bloque"], [new Error("x"), "echec"]];
  for (const [err, code] of cases) {
    const { router, calls } = setup({ login: async () => { throw err; } });
    const cookie = `ika_oauth=${g.packState({ s: "BON", n: "/", t: 1 })}`;
    await withFakeGoogle(async () => {
      const out = await router.call("GET", "/auth/google/callback", { query: { code: "C", state: "BON" }, headers: { cookie } });
      assert.equal(out.location, `/#/connexion?google=${code}`, code);
      assert.equal(calls.sessions.length, 0);
    });
  }
});

test("/config/auth : indique seulement si Google est activé, sans aucun secret", async () => {
  const on = await setup().router.call("GET", "/config/auth", {});
  assert.deepEqual(on.body, { google: true });
  const off = await setup({ enabled: false }).router.call("GET", "/config/auth", {});
  assert.deepEqual(off.body, { google: false });
  assert.ok(!JSON.stringify(on.body).includes("sec"));
});

test("/auth/google/callback : sans acceptation des conditions dans le cookie, le service le sait (et refusera un nouveau compte)", async () => {
  const { router, calls } = setup();
  const cookie = `ika_oauth=${g.packState({ s: "BON", n: "/", t: 0 })}`;
  await withFakeGoogle(async () => {
    await router.call("GET", "/auth/google/callback", { query: { code: "C", state: "BON" }, headers: { cookie } });
  });
  assert.equal(calls.login[0].opts.acceptTerms, false);
});
