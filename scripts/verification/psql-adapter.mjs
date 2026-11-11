// Adaptateur de VÉRIFICATION uniquement (non livré) : db.query() exécuté par psql sur un vrai PostgreSQL,
// faute de pouvoir installer le pilote `pg` ici. Les paramètres $n sont remplacés par des littéraux échappés.
import { spawn, spawnSync } from "node:child_process";

function literal(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("nombre invalide");
    return String(v);
  }
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return `'\\x${Buffer.from(v).toString("hex")}'::bytea`;
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (Array.isArray(v)) return v.length ? `ARRAY[${v.map(literal).join(",")}]` : "ARRAY[]::text[]";
  return `'${String(v).replace(/'/g, "''")}'`;
}

// Cherche, dans une requête « WITH ... », où commence l'instruction principale (au niveau 0 des parenthèses).
function mainStatementStart(sql) {
  let depth = 0, quote = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (quote) { if (c === "'") quote = false; continue; }
    if (c === "'") { quote = true; continue; }
    if (c === "(") depth++; else if (c === ")") depth--;
    else if (depth === 0 && /[a-z]/i.test(c) && (i === 0 || !/[a-z0-9_]/i.test(sql[i - 1]))) {
      const m = sql.slice(i).match(/^(select|insert|update|delete)\b/i);
      if (m) return i;
    }
  }
  return -1;
}

// json_agg écrit les colonnes bytea en "\\x..." : le pilote réel `pg` rend des Buffer, on fait de même.
function revive(v) {
  if (typeof v === "string") return /^\\x([0-9a-f]{2})*$/i.test(v) ? Buffer.from(v.slice(2), "hex") : v;
  if (Array.isArray(v)) return v.map(revive);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)]));
  return v;
}

function render(text, params) {
  const sql = text.replace(/\$(\d+)/g, (_, n) => {
    const i = Number(n) - 1;
    if (i >= params.length) throw new Error(`paramètre $${n} manquant`);
    return literal(params[i]);
  });
  if (/^\s*with\b/i.test(sql)) {
    const at = mainStatementStart(sql);
    const main = at < 0 ? "" : sql.slice(at);
    if (/^select/i.test(main) || /\breturning\b/i.test(main)) {
      return { wrap: true, sql: `${sql.slice(0, at).trimEnd()}, __q as (${main}) select coalesce(json_agg(__q), '[]'::json) from __q` };
    }
    return { wrap: false, sql };
  }
  const wrap = /^\s*select/i.test(sql) || /\breturning\b/i.test(sql);
  return { wrap, sql: wrap ? `with q as (${sql}) select coalesce(json_agg(q), '[]'::json) from q` : sql };
}

// Transaction : un processus psql unique garde la même connexion pour toutes les requêtes de fn.
async function transaction(fn) {
  const child = spawn("psql", ["-X", "-q", "-At"], { env: process.env });
  let out = "", err = "", waiter = null;
  const END = "@@FIN@@";
  const check = () => { if (waiter && out.includes(END + "\n") && err.includes(END + "\n")) { const w = waiter; waiter = null; w(); } };
  child.stdout.on("data", (d) => { out += d; check(); });
  child.stderr.on("data", (d) => { err += d; check(); });
  const run = (sql) => new Promise((resolve, reject) => {
    out = ""; err = "";
    waiter = () => {
      const e = err.replace(END + "\n", "").trim();
      const o = out.replace(END + "\n", "");
      if (e && /ERROR|FATAL/.test(e)) { const x = new Error(e); if (/violates unique constraint/.test(e)) x.code = "23505"; reject(x); } else resolve(o);
    };
    child.stdin.write(`${sql};\n\\echo ${END}\n\\warn ${END}\n`);
  });
  const tx = { async query(text, params = []) { const { wrap, sql } = render(text, params); const o = await run(sql); return wrap ? revive(JSON.parse(o.trim() || "[]")) : []; } };
  await run("begin");
  try {
    const result = await fn(tx);
    await run("commit");
    return result;
  } catch (error) {
    await run("rollback").catch(() => undefined);
    throw error;
  } finally {
    child.stdin.end();
  }
}

export function createDb() {
  return {
    transaction,
    async query(text, params = []) {
      const { wrap, sql: finalSql } = render(text, params);
      const r = spawnSync("psql", ["-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"], {
        input: finalSql,
        encoding: "utf8",
        env: process.env,
      });
      if (r.status !== 0) {
        const err = new Error(r.stderr.trim());
        if (/violates unique constraint/.test(r.stderr)) err.code = "23505";
        throw err;
      }
      if (!wrap) return [];
      return revive(JSON.parse(r.stdout.trim() || "[]"));
    },
    close() {},
  };
}
