// MFA (double authentification) : briques pures, sans dépendance externe (module crypto de Node).
// TOTP selon RFC 6238 (HMAC-SHA1, 6 chiffres, pas de 30 s) : compatible Google Authenticator, Microsoft Authenticator, Authy, 1Password…
// Rien ici ne touche à la base ni à la connexion : ces fonctions sont branchées à l'étape suivante.
import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { sha256 } from "./security.js";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_DIGITS = 6;
export const TOTP_PERIOD = 30;
export const TOTP_WINDOW = 1; // tolérance : un pas avant / après (dérive d'horloge du téléphone)
export const BACKUP_CODE_COUNT = 10;

export function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = ((value << 8) | byte) & 0xfff;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text) {
  const clean = String(text ?? "").toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const index = B32.indexOf(ch);
    if (index < 0) throw new Error("Secret base32 invalide.");
    value = ((value << 5) | index) & 0xfff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Nouveau secret aléatoire de 160 bits, en base32 (32 caractères). */
export const generateSecret = () => base32Encode(randomBytes(20));

function hotp(key, counter, digits = TOTP_DIGITS) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", key).update(message).digest();
  const o = h[19] & 15;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

/** Code attendu à l'instant `timeMs` (utilisé par les tests et par la vérification). */
export function totpCode(secret, timeMs = Date.now(), { digits = TOTP_DIGITS, period = TOTP_PERIOD } = {}) {
  return hotp(base32Decode(secret), Math.floor(timeMs / 1000 / period), digits);
}

/**
 * Vérifie un code à 6 chiffres. Retourne le numéro de pas accepté, ou null.
 * `lastStep` : dernier pas déjà accepté pour ce compte ; un pas inférieur ou égal est refusé (un code ne sert qu'une fois).
 */
export function verifyTotp(secret, code, { now = Date.now(), window = TOTP_WINDOW, lastStep = null } = {}) {
  const clean = String(code ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const key = base32Decode(secret);
  const current = Math.floor(now / 1000 / TOTP_PERIOD);
  let found = null;
  for (let delta = -window; delta <= window; delta += 1) {
    const step = current + delta;
    if (step < 0) continue;
    const same = timingSafeEqual(Buffer.from(hotp(key, step)), Buffer.from(clean));
    if (same && (lastStep === null || lastStep === undefined || step > Number(lastStep))) found = step;
  }
  return found;
}

/** Adresse à encoder dans le QR code d'enrôlement. */
export function otpauthUri(secret, account, issuer = "Ika So") {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

/** Clé de chiffrement des secrets : 32 octets, en hexadécimal (64 caractères) ou en base64. */
export function parseKey(raw) {
  const text = String(raw ?? "").trim();
  const buf = /^[0-9a-fA-F]{64}$/.test(text) ? Buffer.from(text, "hex") : Buffer.from(text, "base64");
  if (buf.length !== 32) throw new Error("MFA_ENCRYPTION_KEY doit représenter 32 octets (64 caractères hexadécimaux ou base64).");
  return buf;
}

/** Chiffre le secret TOTP (AES-256-GCM) avant stockage : une fuite de la base seule ne donne pas les secrets. */
export function encryptSecret(plain, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${data.toString("base64url")}`;
}

export function decryptSecret(blob, key) {
  const [version, iv, tag, data] = String(blob ?? "").split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Secret chiffré illisible.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

// Codes de secours : 10 caractères sans ambiguïté (ni 0/o, ni 1/l/i), affichés « xxxxx-xxxxx », à usage unique.
const BACKUP_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

export function generateBackupCodes(count = BACKUP_CODE_COUNT) {
  return Array.from({ length: count }, () => {
    let raw = "";
    for (let i = 0; i < 10; i += 1) raw += BACKUP_ALPHABET[randomInt(BACKUP_ALPHABET.length)];
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

export const normalizeBackupCode = (code) => String(code ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Seul ce haché est conservé en base ; le code en clair n'est montré qu'une fois. */
export const hashBackupCode = (code) => sha256(`mfa-backup:${normalizeBackupCode(code)}`);
