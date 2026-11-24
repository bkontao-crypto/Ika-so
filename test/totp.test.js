import test from "node:test";
import assert from "node:assert/strict";
import {
  base32Decode,
  base32Encode,
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  generateSecret,
  hashBackupCode,
  normalizeBackupCode,
  otpauthUri,
  parseKey,
  totpCode,
  verifyTotp,
} from "../server/lib/totp.js";

// Vecteurs officiels de la RFC 6238 (SHA-1, secret ASCII « 12345678901234567890 », codes à 8 chiffres).
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));
const RFC_VECTORS = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

test("TOTP : vecteurs de la RFC 6238", () => {
  for (const [seconds, expected] of RFC_VECTORS) {
    assert.equal(totpCode(RFC_SECRET, seconds * 1000, { digits: 8 }), expected, `t=${seconds}`);
  }
});

test("base32 : aller-retour, minuscules et séparateurs tolérés, caractères invalides refusés", () => {
  const raw = Buffer.from("Ika So MFA \u00e9\u00e8");
  assert.deepEqual(base32Decode(base32Encode(raw)), raw);
  assert.equal(base32Encode(Buffer.from("abcde")), "MFRGGZDF");
  assert.equal(base32Decode("mfrg gzdf").toString(), "abcde");
  assert.equal(base32Decode("MFRG-GZDF").toString(), "abcde");
  assert.throws(() => base32Decode("AB1"));
  assert.equal(generateSecret().length, 32);
});

test("verifyTotp : bon code, tolérance d'un pas, mauvais code, format", () => {
  const now = 1234567890 * 1000;
  const good = totpCode(RFC_SECRET, now);
  assert.ok(verifyTotp(RFC_SECRET, good, { now }) !== null);
  assert.ok(verifyTotp(RFC_SECRET, ` ${good.slice(0, 3)} ${good.slice(3)} `, { now }) !== null, "espaces tolérés");
  assert.ok(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, now - 30_000), { now }) !== null, "pas précédent accepté");
  assert.equal(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, now - 90_000), { now }), null, "trois pas d'écart refusé");
  const wrong = good.slice(0, 5) + String((Number(good[5]) + 1) % 10);
  assert.equal(verifyTotp(RFC_SECRET, wrong, { now }), null, "mauvais code refusé");
  assert.equal(verifyTotp(RFC_SECRET, "12345", { now }), null);
  assert.equal(verifyTotp(RFC_SECRET, "abcdef", { now }), null);
  assert.equal(verifyTotp(RFC_SECRET, undefined, { now }), null);
});

test("verifyTotp : un code ne sert qu'une fois (rejeu refusé)", () => {
  const now = 1234567890 * 1000;
  const code = totpCode(RFC_SECRET, now);
  const step = verifyTotp(RFC_SECRET, code, { now });
  assert.ok(step !== null);
  assert.equal(verifyTotp(RFC_SECRET, code, { now, lastStep: step }), null);
  const next = totpCode(RFC_SECRET, now + 30_000);
  assert.ok(verifyTotp(RFC_SECRET, next, { now: now + 30_000, lastStep: step }) !== null);
});

test("otpauthUri : contient secret, émetteur, algorithme et pas", () => {
  const uri = otpauthUri("ABCDEFGH", "babakontao2@gmail.com");
  assert.equal(uri, "otpauth://totp/Ika%20So:babakontao2%40gmail.com?secret=ABCDEFGH&issuer=Ika%20So&algorithm=SHA1&digits=6&period=30");
});

test("chiffrement du secret : aller-retour, clé incorrecte et altération refusées", () => {
  const key = parseKey("a".repeat(64));
  const blob = encryptSecret("JBSWY3DPEHPK3PXP", key);
  assert.ok(!blob.includes("JBSWY3DPEHPK3PXP"));
  assert.equal(decryptSecret(blob, key), "JBSWY3DPEHPK3PXP");
  assert.notEqual(blob, encryptSecret("JBSWY3DPEHPK3PXP", key), "IV aléatoire");
  assert.throws(() => decryptSecret(blob, parseKey("b".repeat(64))));
  const parts = blob.split(".");
  parts[3] = Buffer.from("altéré").toString("base64url");
  assert.throws(() => decryptSecret(parts.join("."), key));
  assert.throws(() => decryptSecret("n'importe quoi", key));
  assert.throws(() => parseKey("trop-court"));
  assert.equal(parseKey(Buffer.alloc(32, 7).toString("base64")).length, 32);
});

test("codes de secours : 10 codes uniques, format, normalisation et haché stable", () => {
  const codes = generateBackupCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const code of codes) assert.match(code, /^[2-9a-hj-km-np-z]{5}-[2-9a-hj-km-np-z]{5}$/);
  const [first] = codes;
  assert.equal(normalizeBackupCode(first.toUpperCase()), normalizeBackupCode(first));
  assert.equal(hashBackupCode(first), hashBackupCode(` ${first.toUpperCase().replace("-", " ")} `));
  assert.notEqual(hashBackupCode(first), hashBackupCode(codes[1]));
  assert.match(hashBackupCode(first), /^[0-9a-f]{64}$/);
});
