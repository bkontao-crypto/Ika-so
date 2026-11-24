// TOTP / HOTP : vecteurs officiels des RFC 4226 et 6238, et chiffrement du secret.
import test from "node:test";
import assert from "node:assert/strict";
import { base32Decode, base32Encode, hotp, verifyTotp } from "../server/lib/totp.js";
import { open, parseKey, seal } from "../server/lib/secret-box.js";

const SECRET = Buffer.from("12345678901234567890", "ascii");

test("HOTP : vecteurs de la RFC 4226", () => {
  assert.equal(hotp(SECRET, 0), "755224");
  assert.equal(hotp(SECRET, 1), "287082");
  assert.equal(hotp(SECRET, 2), "359152");
});

test("TOTP : vecteurs de la RFC 6238 (SHA-1, 8 chiffres)", () => {
  const step = (seconds) => Math.floor(seconds / 30);
  assert.equal(hotp(SECRET, step(59), 8), "94287082");
  assert.equal(hotp(SECRET, step(1111111109), 8), "07081804");
  assert.equal(hotp(SECRET, step(1234567890), 8), "89005924");
  assert.equal(hotp(SECRET, step(2000000000), 8), "69279037");
});

test("base32 : aller-retour", () => {
  const raw = Buffer.from("0123456789abcdefghij", "ascii");
  assert.deepEqual(base32Decode(base32Encode(raw)), raw);
  assert.equal(base32Encode(Buffer.from("foobar", "ascii")), "MZXW6YTBOI");
  assert.throws(() => base32Decode("1!"), /Base32/);
});

test("verifyTotp : tolère un pas de décalage, refuse un code rejoué ou trop ancien", () => {
  const now = 1_700_000_000_000;
  const step = Math.floor(now / 1000 / 30);
  assert.equal(verifyTotp(SECRET, hotp(SECRET, step), { now }), step);
  assert.equal(verifyTotp(SECRET, hotp(SECRET, step - 1), { now }), step - 1);
  assert.equal(verifyTotp(SECRET, hotp(SECRET, step - 2), { now }), null);
  assert.equal(verifyTotp(SECRET, hotp(SECRET, step), { now, lastStep: step }), null);
  assert.equal(verifyTotp(SECRET, "abc123", { now }), null);
});

test("secret-box : chiffrement réversible, falsification et mauvaise clé refusées", () => {
  const key = parseKey(Buffer.alloc(32, 7).toString("base64"));
  const sealed = seal(key, "JBSWY3DPEHPK3PXP");
  assert.ok(!sealed.includes("JBSWY3DPEHPK3PXP"));
  assert.equal(open(key, sealed), "JBSWY3DPEHPK3PXP");
  assert.notEqual(seal(key, "x"), seal(key, "x"));
  assert.throws(() => open(parseKey(Buffer.alloc(32, 9).toString("base64")), sealed));
  const parts = sealed.split(".");
  parts[3] = Buffer.from("altéré").toString("base64url");
  assert.throws(() => open(key, parts.join(".")));
  assert.throws(() => parseKey("trop-court"), /32 octets/);
});
