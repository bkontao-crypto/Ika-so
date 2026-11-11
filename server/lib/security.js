import { createHash, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { tooMany } from "./errors.js";

const scrypt = promisify(scryptCb);
const SCRYPT = { N: 16384, r: 8, p: 1 };

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export const newId = (prefix) => `${prefix}-${randomUUID()}`;

/** Comparaison en temps constant de deux chaînes (hachages hexadécimaux). */
export function sameHash(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, n, salt, hash] = String(stored).split("$");
  if (scheme !== "scrypt" || !n || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await scrypt(password, Buffer.from(salt, "base64url"), expected.length, {
    ...SCRYPT,
    N: Number(n),
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Hachage factice : sert à occuper le même temps quand l'e-mail n'existe pas. */
export const DUMMY_HASH =
  "scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA$" + Buffer.alloc(64).toString("base64url");

export function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const key = part.slice(0, index).trim();
    try {
      out[key] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      /* cookie illisible : ignoré */
    }
  }
  return out;
}

/**
 * Limitation de débit en mémoire, par instance (meilleur effort).
 * L'OTP, lui, est limité en base. Rien n'est conservé hors de la mémoire du processus.
 */
export function createRateLimiter(now = () => Date.now()) {
  const hits = new Map();
  return {
    hit(key, max, windowMs) {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((time) => t - time < windowMs);
      if (recent.length >= max) throw tooMany();
      recent.push(t);
      hits.set(key, recent);
      if (hits.size > 5000) {
        for (const [k, list] of hits) if (!list.some((time) => t - time < 3_600_000)) hits.delete(k);
      }
    },
    /** Refuse (429) si `max` échecs ont déjà été notés dans la fenêtre. N'enregistre rien. */
    check(key, max, windowMs) {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((time) => t - time < windowMs);
      if (recent.length >= max) throw tooMany();
    },
    /** Note un échec pour `key` (à appeler seulement quand la tentative a échoué). */
    record(key) {
      const list = hits.get(key) ?? [];
      list.push(now());
      hits.set(key, list);
    },
    /** Efface les échecs notés pour `key` (après une réussite). */
    forget(key) {
      hits.delete(key);
    },
    reset() {
      hits.clear();
    },
  };
}
