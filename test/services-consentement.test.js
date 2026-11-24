// Services « Préférences » et « Marketing » activables depuis l'Owner center (réglage consent_services).
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeConsentServices, publicConsentServices, consentCspHosts, DEFAULT_CONSENT_SERVICES } from "../server/lib/consent-services.js";
import { contentSecurityPolicy } from "../server/lib/web.js";

test("par défaut : tout est éteint, aucun hôte ouvert", () => {
  const n = normalizeConsentServices(null);
  assert.deepEqual(publicConsentServices(n), { preferences: false, marketing: [] });
  assert.deepEqual(consentCspHosts(n), { script: [], connect: [], img: [] });
  assert.equal(contentSecurityPolicy({}, consentCspHosts(n)), contentSecurityPolicy({}));
});

test("un pixel valide est actif et ouvre uniquement ses adresses", () => {
  const n = normalizeConsentServices({ marketing: { meta: { enabled: true, id: "123456789012345" } } }, { strict: true });
  assert.deepEqual(publicConsentServices(n).marketing, [{ provider: "meta", id: "123456789012345" }]);
  const csp = contentSecurityPolicy({}, consentCspHosts(n));
  assert.match(csp, /script-src 'self' https:\/\/connect\.facebook\.net/);
  assert.ok(!/tiktok|googletagmanager/.test(csp));
  assert.ok(!/unsafe-inline|unsafe-eval/.test(csp));
});

test("identifiant invalide : refusé à l'enregistrement, éteint à la lecture", () => {
  assert.throws(() => normalizeConsentServices({ marketing: { google: { enabled: true, id: "n'importe quoi" } } }, { strict: true }), /identifiant invalide/i);
  const n = normalizeConsentServices({ marketing: { google: { enabled: true, id: "<script>" } } });
  assert.equal(n.marketing.google.enabled, false);
  assert.deepEqual(publicConsentServices(n).marketing, []);
});

test("service coché sans identifiant valide : jamais chargé ; décoché : identifiant gardé mais inactif", () => {
  assert.equal(normalizeConsentServices({ marketing: { tiktok: { enabled: true, id: "" } } }).marketing.tiktok.enabled, false);
  const n = normalizeConsentServices({ marketing: { tiktok: { enabled: false, id: "c1abcdef2ghijk" } } }, { strict: true });
  assert.equal(n.marketing.tiktok.enabled, false);
  assert.equal(n.marketing.tiktok.id, "C1ABCDEF2GHIJK");
  assert.deepEqual(publicConsentServices(n).marketing, []);
});

test("préférences : seulement si true strict", () => {
  assert.equal(normalizeConsentServices({ preferences: { enabled: "oui" } }).preferences.enabled, false);
  assert.equal(normalizeConsentServices({ preferences: { enabled: true } }).preferences.enabled, true);
  assert.equal(DEFAULT_CONSENT_SERVICES.preferences.enabled, false);
});
