// Trace d'acceptation visible dans Mon profil : conditions (date, version) et choix sur les données (date, version du texte).
import test from "node:test";
import assert from "node:assert/strict";
import { createAnalytics } from "../server/services/analytics.js";

const make = (users, consents) => createAnalytics({ config: { analytics: { enabled: true } }, db: { async query(sql, p = []) {
  if (/from ika_analytics_consent/.test(sql)) return consents[p[0]] ? [consents[p[0]]] : [];
  if (/from ika_users/.test(sql)) return users[p[0]] ? [users[p[0]]] : [];
  return [];
} } });

test("choix et conditions : dates et versions renvoyées au titulaire", async () => {
  const a = make({ u1: { terms_version: "2026-11-20-provisoire", terms_accepted_at: "2026-11-23T09:42:00Z" } }, { u1: { accepted: true, text_version: "v1", decided_at: "2026-11-23T09:42:01Z" } });
  const c = await a.getConsent("u1");
  assert.equal(c.accepted, true);
  assert.equal(c.terms.version, "2026-11-20-provisoire"); assert.equal(c.terms.acceptedAt, "2026-11-23T09:42:00Z");
  assert.equal(c.decidedAt, "2026-11-23T09:42:01Z"); assert.equal(c.decidedTextVersion, "v1");
});
test("choix désactivé : la date de la décision est conservée", async () => {
  const a = make({ u1: { terms_version: "v", terms_accepted_at: "2026-11-01T00:00:00Z" } }, { u1: { accepted: false, text_version: "v1", decided_at: "2026-11-24T10:00:00Z" } });
  const c = await a.getConsent("u1");
  assert.equal(c.accepted, false); assert.equal(c.decidedAt, "2026-11-24T10:00:00Z");
});
test("compte ancien sans choix enregistré : aucune date inventée", async () => {
  const c = await make({ u2: { terms_version: null, terms_accepted_at: null } }, {}).getConsent("u2");
  assert.equal(c.accepted, null); assert.equal(c.decidedAt, null); assert.equal(c.terms.acceptedAt, null);
});
