/**
 * Sauvegarde PostgreSQL réelle : pg_dump (format custom) -> fichier vérifié (pg_restore --list + SHA-256) -> rotation.
 *
 * Limites assumées (à lire avant de s'y fier) :
 *  - le fichier reste sur le disque du serveur : si ce disque est éphémère (Render sans disque persistant), la copie disparaît
 *    avec lui. Pour une vraie copie hors serveur et chiffrée, utilisez scripts/backup.sh (age + rclone) ;
 *  - la vérification ici contrôle l'intégrité du fichier (lisible par pg_restore, empreinte inchangée), PAS une restauration
 *    complète : pour cela, scripts/restore-check.sh sur un serveur jetable ;
 *  - le dump contient des données personnelles : répertoire en mode 0700, fichiers en 0600, jamais sous public/.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { chmod, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

export const BACKUP_NAME = /^ika-so-\d{8}T\d{6}Z\.dump$/;

/** Découpe l'URL PostgreSQL en variables PG* : le mot de passe ne passe alors jamais dans la ligne de commande. */
export function pgEnvFromUrl(databaseUrl) {
  let url;
  try { url = new URL(databaseUrl); } catch { throw new Error("DATABASE_URL invalide."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("DATABASE_URL doit être une URL PostgreSQL.");
  const env = {
    PGHOST: decodeURIComponent(url.hostname), PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\/+/, "")),
  };
  const ssl = url.searchParams.get("sslmode");
  if (ssl) env.PGSSLMODE = ssl;
  return env;
}

/** Exécute une commande sans shell. Renvoie { code, stderr }. `env` s'ajoute à un environnement minimal (PATH). */
export function runCommand(cmd, args, { env = {}, timeoutMs = 10 * 60_000 } = {}) {
  return new Promise((resolveRun) => {
    let stderr = "";
    let child;
    try { child = spawn(cmd, args, { env: { PATH: process.env.PATH ?? "", ...env }, stdio: ["ignore", "ignore", "pipe"], timeout: timeoutMs }); }
    catch (error) { return resolveRun({ code: 127, stderr: String(error?.message ?? error) }); }
    child.stderr.on("data", (c) => { if (stderr.length < 4000) stderr += c; });
    child.on("error", (error) => resolveRun({ code: error?.code === "ENOENT" ? 127 : 1, stderr: error?.code === "ENOENT" ? `Commande absente : ${cmd}` : String(error?.message ?? error) }));
    child.on("close", (code) => resolveRun({ code: code ?? 1, stderr }));
  });
}

const sha256Of = (file) => new Promise((ok, ko) => {
  const hash = createHash("sha256");
  createReadStream(file).on("data", (c) => hash.update(c)).on("error", ko).on("end", () => ok(hash.digest("hex")));
});
const clean = (text) => String(text ?? "").replace(/postgres(ql)?:\/\/\S+/gi, "[url]").replace(/\s+/g, " ").trim().slice(0, 300);
const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

export function createBackupRunner({ databaseUrl, dir, keep = 14, run = runCommand, now = () => new Date() }) {
  const root = resolve(dir || "backups");
  const configured = Boolean(databaseUrl);

  async function prune() {
    const names = (await readdir(root)).filter((n) => BACKUP_NAME.test(n)).sort(); // l'horodatage trie par date
    const old = names.slice(0, Math.max(0, names.length - keep));
    for (const n of old) { await unlink(join(root, n)).catch(() => {}); await unlink(join(root, `${n}.sha256`)).catch(() => {}); }
    return old.length;
  }

  /** Crée une sauvegarde vérifiée. Lève une erreur claire (sans secret) en cas d'échec ; aucun fichier partiel n'est conservé. */
  async function backup() {
    if (!configured) throw new Error("Sauvegarde impossible : DATABASE_URL absente.");
    const env = pgEnvFromUrl(databaseUrl);
    await mkdir(root, { recursive: true, mode: 0o700 });
    await chmod(root, 0o700).catch(() => {});
    const fileName = `ika-so-${stamp(now())}.dump`;
    const part = join(root, `${fileName}.part`);
    try {
      const dump = await run("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", `--file=${part}`], { env });
      if (dump.code !== 0) throw new Error(`pg_dump a échoué (code ${dump.code}) : ${clean(dump.stderr)}`);
      const size = (await stat(part)).size;
      if (!size) throw new Error("Le fichier de sauvegarde est vide.");
      const list = await run("pg_restore", ["--list", part], {});
      if (list.code !== 0) throw new Error(`Le fichier produit n'est pas lisible par pg_restore : ${clean(list.stderr)}`);
      const sha256 = await sha256Of(part);
      const final = join(root, fileName);
      await rename(part, final);
      await chmod(final, 0o600).catch(() => {});
      await writeFile(`${final}.sha256`, `${sha256}  ${fileName}\n`, { mode: 0o600 });
      const pruned = await prune().catch(() => 0);
      return { fileName, sizeBytes: size, sha256, pruned };
    } catch (error) {
      await unlink(part).catch(() => {});
      throw error;
    }
  }

  /** Contrôle d'intégrité d'un fichier déjà créé : nom valide, empreinte inchangée, archive lisible. Ce n'est pas une restauration. */
  async function verify(fileName) {
    if (!BACKUP_NAME.test(String(fileName)) || basename(fileName) !== fileName) throw new Error("Nom de sauvegarde invalide.");
    const file = join(root, fileName);
    const size = await stat(file).then((s) => s.size).catch(() => 0);
    if (!size) return { ok: false, reason: "Fichier introuvable ou vide (disque éphémère ?)." };
    const expected = (await readFile(`${file}.sha256`, "utf8").catch(() => "")).split(/\s+/)[0];
    const actual = await sha256Of(file);
    if (!expected) return { ok: false, reason: "Fichier d'empreinte (.sha256) absent." };
    if (expected !== actual) return { ok: false, reason: "L'empreinte SHA-256 ne correspond plus : fichier altéré." };
    const list = await run("pg_restore", ["--list", file], {});
    if (list.code !== 0) return { ok: false, reason: `Archive illisible : ${clean(list.stderr)}` };
    return { ok: true, sizeBytes: size, sha256: actual };
  }

  return { backup, verify, dir: root, configured };
}
