// Service MFA : fausse base à états, on vérifie l'activation, l'usage unique des codes et le verrouillage.
import test from "node:test";
import assert from "node:assert/strict";
import { createMfa } from "../server/services/mfa.js";
import { base32Decode, hotp, totpStep } from "../server/lib/totp.js";
import { open, parseKey } from "../server/lib/secret-box.js";
import { sha256 } from "../server/lib/security.js";

const key = parseKey(Buffer.alloc(32, 3).toString("base64"));

function setup() {
  const state = { row: null, recovery: [], calls: [] };
  const run = async (sql, p = []) => {
    state.calls.push({ sql, p });
    if (/from ika_mfa where user_id/.test(sql)) return state.row ? [state.row] : [];
    if (/insert into ika_mfa \(/.test(sql)) {
      state.row = { user_id: p[0], secret_enc: p[1], enabled_at: null, last_step: 0, failed_attempts: 0, locked_until: null };
      return [];
    }
    if (/update ika_mfa set enabled_at/.test(sql)) {
      if (state.row.enabled_at) return [];
      Object.assign(state.row, { enabled_at: new Date(), last_step: p[1] });
      return [{ user_id: p[0] }];
    }
    if (/update ika_mfa set last_step/.test(sql)) {
      if (!(Number(state.row.last_step) < p[1])) return [];
      state.row.last_step = p[1];
      return [{ user_id: p[0] }];
    }
    if (/update ika_mfa set failed_attempts = failed_attempts \+ 1/.test(sql)) {
      state.row.failed_attempts += 1;
      if (state.row.failed_attempts >= p[1]) state.row.locked_until = new Date(Date.now() + 15 * 60_000);
      return [];
    }
    if (/update ika_mfa set failed_attempts = 0/.test(sql)) return [];
    if (/delete from ika_mfa_recovery_codes/.test(sql)) { state.recovery.length = 0; return []; }
    if (/insert into ika_mfa_recovery_codes/.test(sql)) { state.recovery.push({ hash: p[2], used: false }); return []; }
    if (/update ika_mfa_recovery_codes set used_at/.test(sql)) {
      const hit = state.recovery.find((r) => r.hash === p[1] && !r.used);
      if (!hit) return [];
      hit.used = true;
      return [{ id: "x" }];
    }
    if (/count\(\*\)::int as n from ika_mfa_recovery_codes/.test(sql)) return [{ n: state.recovery.filter((r) => !r.used).length }];
    return [];
  };
  const db = { query: run, transaction: async (fn) => fn({ query: run }) };
  return { state, mfa: createMfa({ db, config: {} }, { key }) };
}

const currentCode = (state) => hotp(base32Decode(open(key, state.row.secret_enc)), totpStep());

test("sans clé configurée : l'activation est refusée proprement", async () => {
  const { mfa } = (() => { const s = setup(); return { mfa: createMfa({ db: { query: async () => [], transaction: async (f) => f({ query: async () => [] }) }, config: {} }) , s }; })();
  const previous = process.env.MFA_ENCRYPTION_KEY;
  delete process.env.MFA_ENCRYPTION_KEY;
  try {
    await assert.rejects(mfa.beginEnrollment("u1", "a@ex.com"), /pas encore configurée/);
  } finally {
    if (previous !== undefined) process.env.MFA_ENCRYPTION_KEY = previous;
  }
});

test("activation : le secret est stocké chiffré, inactif tant que non confirmé, 8 codes de secours hachés", async () => {
  const { state, mfa } = setup();
  const begin = await mfa.beginEnrollment("u1", "a@ex.com");
  assert.match(begin.otpauthUri, /^otpauth:\/\/totp\/Ika%20So%3Aa%40ex\.com\?secret=[A-Z2-7]+&issuer=Ika%20So/);
  assert.ok(!state.row.secret_enc.includes(begin.secret));
  assert.equal((await mfa.status("u1")).enabled, false);
  await assert.rejects(mfa.confirmEnrollment("u1", "000000"), /Code incorrect/);
  const done = await mfa.confirmEnrollment("u1", currentCode(state));
  assert.equal(done.recoveryCodes.length, 8);
  assert.ok(done.recoveryCodes.every((c) => /^[0-9a-f]{5}-[0-9a-f]{5}$/.test(c)));
  assert.ok(state.recovery.every((r) => !done.recoveryCodes.includes(r.hash)));
  assert.deepEqual(await mfa.status("u1"), { enabled: true, recoveryCodesLeft: 8 });
  await assert.rejects(mfa.beginEnrollment("u1", "a@ex.com"), /déjà activée/);
});

test("connexion : un code TOTP ne sert qu'une fois ; un code de secours ne sert qu'une fois", async () => {
  const { state, mfa } = setup();
  await mfa.beginEnrollment("u1", "a@ex.com");
  const { recoveryCodes } = await mfa.confirmEnrollment("u1", currentCode(state));
  state.row.last_step = totpStep() - 5; // on rejoue plus tard : le pas courant est de nouveau libre
  const code = currentCode(state);
  assert.deepEqual(await mfa.verifyChallenge("u1", code), { ok: true, method: "TOTP" });
  await assert.rejects(mfa.verifyChallenge("u1", code), /Code incorrect/);
  assert.deepEqual(await mfa.verifyChallenge("u1", recoveryCodes[0].toUpperCase()), { ok: true, method: "RECOVERY" });
  await assert.rejects(mfa.verifyChallenge("u1", recoveryCodes[0]), /Code incorrect/);
  assert.equal((await mfa.status("u1")).recoveryCodesLeft, 7);
});

test("verrouillage : après 5 échecs, même le bon code est refusé", async () => {
  const { state, mfa } = setup();
  await mfa.beginEnrollment("u1", "a@ex.com");
  await mfa.confirmEnrollment("u1", currentCode(state));
  state.row.last_step = totpStep() - 5;
  for (let i = 0; i < 5; i += 1) await assert.rejects(mfa.verifyChallenge("u1", "000000"), /Code incorrect/);
  await assert.rejects(mfa.verifyChallenge("u1", currentCode(state)), /Trop d'essais/);
});
