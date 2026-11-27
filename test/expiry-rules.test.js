import test from "node:test";
import assert from "node:assert/strict";
import { DAY_MS, DEFAULT_EXPIRY_SETTINGS, applicableWarningDays, daysLeft, displayStatus, endOfDay, normalizeExpirySettings, resolveExtension, validatePublicationDates, warningKind } from "../server/lib/expiry.js";

const NOW = Date.UTC(2026, 10, 27, 15, 0, 0); // 27 novembre 2026, 15 h

test("prolongation 30 jours : 27 novembre -> 27 décembre 2026 (exemple du cahier des charges)", () => {
  const r = resolveExtension({ nowMs: NOW, days: 30 });
  assert.equal(r.date, "2026-12-27");
  assert.equal(r.expiresAt.toISOString(), "2026-12-27T23:59:59.999Z");
});
test("prolongation 7 jours : nouvelle date correcte", () => {
  assert.equal(resolveExtension({ nowMs: NOW, days: 7 }).date, "2026-12-04");
});
test("prolongation par date choisie, dans la limite", () => {
  assert.equal(resolveExtension({ nowMs: NOW, until: "2026-12-10" }).date, "2026-12-10");
});
test("prolongation supérieure à 30 jours : refusée (jours et date)", () => {
  assert.throws(() => resolveExtension({ nowMs: NOW, days: 31 }), /30 jours/);
  assert.throws(() => resolveExtension({ nowMs: NOW, until: "2026-12-28" }), /30 jours/);
});
test("prolongation : date passée, du jour ou invalide refusée", () => {
  assert.throws(() => resolveExtension({ nowMs: NOW, until: "2026-11-27" }), /postérieure/);
  assert.throws(() => resolveExtension({ nowMs: NOW, until: "2026-11-01" }), /postérieure/);
  assert.throws(() => resolveExtension({ nowMs: NOW, until: "2026-02-30" }), /invalide/);
  assert.throws(() => resolveExtension({ nowMs: NOW, days: 0 }), /invalide/);
});
test("le plafond du Superadmin ne dépasse jamais 30 jours", () => {
  assert.equal(normalizeExpirySettings({ maxExtensionDays: 10 }).maxExtensionDays, 10);
  assert.throws(() => normalizeExpirySettings({ maxExtensionDays: 45 }, { strict: true }), /30/);
  assert.equal(normalizeExpirySettings({ maxExtensionDays: 45 }).maxExtensionDays, 30); // lecture : valeur invalide ignorée
  assert.throws(() => resolveExtension({ nowMs: NOW, days: 11, maxDays: 10 }), /10 jours/);
});
test("réglages : valeurs initiales et validation stricte", () => {
  assert.deepEqual(normalizeExpirySettings(null), DEFAULT_EXPIRY_SETTINGS);
  assert.deepEqual(normalizeExpirySettings({ warningDays: [1, 7, 3, 7] }).warningDays, [7, 3, 1]);
  assert.throws(() => normalizeExpirySettings({ warningDays: [0] }, { strict: true }));
  assert.throws(() => normalizeExpirySettings({ autoArchiveDays: 0 }, { strict: true }));
  assert.equal(normalizeExpirySettings({ autoArchiveDays: 45 }).autoArchiveDays, 45);
});
test("dates de publication : fin postérieure au début, et dans le futur", () => {
  assert.throws(() => validatePublicationDates({ startsAt: "2026-12-10", expiresAt: "2026-12-05" }, NOW), /postérieure/);
  assert.throws(() => validatePublicationDates({ expiresAt: "2026-11-01" }, NOW), /futur/);
  assert.throws(() => validatePublicationDates({ startsAt: "n'importe quoi" }, NOW), /début/);
  const ok = validatePublicationDates({ startsAt: "2026-12-01T00:00:00Z", expiresAt: "2026-12-31T00:00:00Z" }, NOW);
  assert.equal(ok.expiresAt.toISOString(), "2026-12-31T00:00:00.000Z");
  assert.deepEqual(validatePublicationDates({}, NOW), { startsAt: null, expiresAt: null });
});
test("avertissements J-7, J-3, J-1 : jours applicables, du plus proche au plus lointain", () => {
  const exp = (d) => NOW + d * DAY_MS;
  assert.deepEqual(applicableWarningDays(exp(8), NOW, [7, 3, 1]), []);
  assert.deepEqual(applicableWarningDays(exp(7), NOW, [7, 3, 1]), [7]);
  assert.deepEqual(applicableWarningDays(exp(3), NOW, [7, 3, 1]), [3, 7]);
  assert.deepEqual(applicableWarningDays(exp(1), NOW, [7, 3, 1]), [1, 3, 7]);
  assert.deepEqual(applicableWarningDays(NOW - 1, NOW, [7, 3, 1]), []); // déjà échue : rien
  assert.equal(warningKind(7), "BEFORE_7");
});
test("jours restants et libellés de statut", () => {
  assert.equal(daysLeft(NOW + 2.2 * DAY_MS, NOW), 3);
  const pub = (d) => ({ status: "PUBLISHED", expires_at: new Date(NOW + d * DAY_MS) });
  assert.equal(displayStatus(pub(30), NOW), "PUBLISHED");
  assert.equal(displayStatus(pub(5), NOW), "EXPIRING_SOON");
  assert.equal(displayStatus(pub(-1), NOW), "EXPIRED");
  assert.equal(displayStatus({ status: "ARCHIVED", archived_mode: "AUTO" }, NOW), "ARCHIVED_AUTO");
  assert.equal(displayStatus({ status: "ARCHIVED", archived_mode: "MANUAL" }, NOW), "ARCHIVED");
  assert.equal(displayStatus({ status: "SCHEDULED" }, NOW), "SCHEDULED");
  assert.equal(endOfDay("2026-13-01"), null);
});
