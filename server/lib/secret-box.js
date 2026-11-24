// Chiffrement des secrets au repos : AES-256-GCM. La clé (32 octets, base64) vient d'une variable d'environnement, jamais du dépôt.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function parseKey(raw) {
  const key = Buffer.from(String(raw ?? ""), "base64");
  if (key.length !== 32) throw new Error("La clé de chiffrement doit faire 32 octets, encodée en base64.");
  return key;
}

export function seal(key, plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function open(key, sealed) {
  const [version, iv, tag, data] = String(sealed ?? "").split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Secret illisible.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
