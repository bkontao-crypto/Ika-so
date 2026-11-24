// TOTP (RFC 6238) et HOTP (RFC 4226) avec le seul module node:crypto : aucune dépendance ajoutée.
import { createHmac, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text) {
  const clean = String(text ?? "").replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Base32 invalide.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
    value &= (1 << bits) - 1;
  }
  return Buffer.from(out);
}

/** Code à `digits` chiffres pour un compteur donné (secret : Buffer). */
export function hotp(secret, counter, digits = 6) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(message).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function totpStep(timeMs = Date.now(), period = 30) {
  return Math.floor(timeMs / 1000 / period);
}

function sameCode(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Vérifie un code TOTP à 6 chiffres. Renvoie le pas de temps accepté, ou null.
 * `lastStep` : dernier pas déjà utilisé ; un pas égal ou antérieur est refusé (un code ne sert qu'une fois).
 */
export function verifyTotp(secret, code, { now = Date.now(), window = 1, lastStep = 0, digits = 6 } = {}) {
  const clean = String(code ?? "").replace(/\s+/g, "");
  if (!new RegExp(`^\\d{${digits}}$`).test(clean)) return null;
  const current = totpStep(now);
  for (let step = current - window; step <= current + window; step += 1) {
    if (step <= lastStep) continue;
    if (sameCode(hotp(secret, step, digits), clean)) return step;
  }
  return null;
}
