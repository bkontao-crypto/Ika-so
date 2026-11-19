// Habitudes de connexion (Super Administrateur) : fonctions pures, sans base. Source : journal de connexions (ika_security_log, LOGIN réussies).
// Heures en UTC, identiques à l'heure du Mali (UTC+0).
import { csvCell } from "./activity-feed.js";
import { buildPdf } from "./simple-pdf.js";

export const HOUR_BUCKETS = Object.freeze([[0, 6], [6, 9], [9, 12], [12, 14], [14, 18], [18, 21], [21, 24]]);
export const DAY_NAMES = Object.freeze(["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]);

const pad = (n) => String(n).padStart(2, "0");

/** byHour : 24 entiers. Retourne les 7 tranches de la spécification, avec la part de chaque tranche (null si aucune connexion). */
export function bucketHours(byHour) {
  const hours = Array.from({ length: 24 }, (_, i) => Math.max(0, Number(byHour?.[i]) || 0));
  const total = hours.reduce((a, b) => a + b, 0);
  return HOUR_BUCKETS.map(([from, to]) => {
    const count = hours.slice(from, to).reduce((a, b) => a + b, 0);
    return { from, to, label: `${pad(from)} h – ${pad(to % 24)} h`, count, sharePct: total ? Math.round((count / total) * 1000) / 10 : null };
  });
}

/** Heure de pointe (heure seule) ou null s'il n'y a aucune connexion. */
export function peakHour(byHour) {
  const max = Math.max(0, ...Array.from({ length: 24 }, (_, i) => Number(byHour?.[i]) || 0));
  return max > 0 ? byHour.findIndex((v) => Number(v) === max) : null;
}

/** byIsoDow : { 1..7 → nombre } (1 = lundi, 7 = dimanche). Semaine = lundi à vendredi ; la moyenne tient compte du nombre de jours de chaque type. */
export function weekSplit(byIsoDow, weekdayDays = 0, weekendDays = 0) {
  const get = (d) => Math.max(0, Number(byIsoDow?.[d]) || 0);
  const weekday = [1, 2, 3, 4, 5].reduce((a, d) => a + get(d), 0);
  const weekend = get(6) + get(7);
  const max = Math.max(0, ...[1, 2, 3, 4, 5, 6, 7].map(get));
  const busiest = max > 0 ? [1, 2, 3, 4, 5, 6, 7].find((d) => get(d) === max) : null;
  return {
    weekday, weekend,
    weekdayAvgPerDay: weekdayDays > 0 ? Math.round((weekday / weekdayDays) * 10) / 10 : null,
    weekendAvgPerDay: weekendDays > 0 ? Math.round((weekend / weekendDays) * 10) / 10 : null,
    busiestDay: busiest ? DAY_NAMES[busiest - 1] : null,
    perDay: DAY_NAMES.map((name, i) => ({ day: name, count: get(i + 1) })),
  };
}

/** Compte les jours ouvrés (lundi à vendredi) et de week-end dans une liste de dates « AAAA-MM-JJ ». */
export function countDayTypes(dayKeys) {
  let weekday = 0; let weekend = 0;
  for (const k of dayKeys) { const dow = new Date(`${k}T00:00:00Z`).getUTCDay(); (dow === 0 || dow === 6 ? weekend++ : weekday++); }
  return { weekday, weekend };
}

const dash = (v) => (v == null ? "—" : String(v));
const stamp = (iso) => String(iso ?? "").replace("T", " ").slice(0, 16);

/** Lignes « rubrique, libellé, valeur » communes au CSV et au PDF : mêmes chiffres, même périmètre. */
export function connectionRows(c, generatedAt) {
  const r = [];
  r.push(["Périmètre", "Généré le (UTC)", stamp(generatedAt)], ["Périmètre", "Période (jours)", c.days], ["Périmètre", "Du (UTC)", stamp(c.from)], ["Périmètre", "Mesuré depuis (UTC)", c.since ? stamp(c.since) : "aucune connexion enregistrée"]);
  r.push(["Indicateurs", "Connexions réussies sur la période", c.totals.logins]);
  r.push(["Indicateurs", "Comptes connectés, 24 dernières heures", dash(c.active.last24h)], ["Indicateurs", "Comptes connectés, 7 jours", dash(c.active.last7d)], ["Indicateurs", "Comptes connectés, 30 jours", dash(c.active.last30d)]);
  r.push(["Indicateurs", "Comptes sans nouvelle connexion depuis 30 jours", dash(c.inactive.since30d)], ["Indicateurs", "Comptes sans nouvelle connexion depuis 60 jours", dash(c.inactive.since60d)], ["Indicateurs", "Comptes sans nouvelle connexion depuis 90 jours", dash(c.inactive.since90d)]);
  r.push(["Indicateurs", "Comptes sans connexion enregistrée", dash(c.neverLoggedIn)], ["Indicateurs", "Comptes au total", dash(c.accounts)]);
  r.push(["Indicateurs", "Heure de pointe (UTC)", c.peakHour == null ? "—" : `${String(c.peakHour).padStart(2, "0")} h`]);
  for (const b of c.buckets) r.push(["Tranches horaires (UTC)", b.label, `${b.count}${b.sharePct == null ? "" : ` (${String(b.sharePct).replace(".", ",")} %)`}`]);
  r.push(["Semaine et week-end", "Lundi à vendredi", `${c.week.weekday} (moyenne ${dash(c.week.weekdayAvgPerDay)} par jour)`], ["Semaine et week-end", "Samedi et dimanche", `${c.week.weekend} (moyenne ${dash(c.week.weekendAvgPerDay)} par jour)`], ["Semaine et week-end", "Jour le plus fréquenté", dash(c.week.busiestDay)]);
  for (const [k, v] of Object.entries(c.devices)) r.push(["Appareils", k, v]);
  return r;
}

/** CSV (UTF-8 avec BOM pour Excel, séparateur virgule, cellules protégées contre l'injection de formule). */
export function connectionsToCsv(c, generatedAt) {
  const lines = [["rubrique", "libelle", "valeur"].join(",")];
  for (const row of connectionRows(c, generatedAt)) lines.push(row.map(csvCell).join(","));
  for (const d of c.perDay) lines.push(["Connexions par jour", d.day, `${d.logins} connexion(s), ${d.users} compte(s) distinct(s)`].map(csvCell).join(","));
  for (const n of c.notes) lines.push(["Définitions", "Note", n].map(csvCell).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** PDF de synthèse : périmètre, indicateurs, tranches horaires, jours, définitions. */
export function connectionsToPdf(c, generatedAt) {
  const rows = connectionRows(c, generatedAt);
  const section = (name) => rows.filter((r) => r[0] === name).map(([, label, value]) => [label, String(value)]);
  return buildPdf({
    title: "Ika So - Habitudes de connexion",
    subtitle: `Rapport du Super Administrateur. Généré le ${stamp(generatedAt)} (UTC, identique à l'heure du Mali). Période : ${c.days} jour(s).`,
    footer: "Ika So - confidentiel",
    sections: [
      { heading: "Périmètre", rows: section("Périmètre") },
      { heading: "Indicateurs", rows: section("Indicateurs") },
      { heading: "Tranches horaires (UTC)", rows: section("Tranches horaires (UTC)") },
      { heading: "Semaine et week-end", rows: section("Semaine et week-end") },
      { heading: "Appareils", rows: section("Appareils").length ? section("Appareils") : [["Aucune connexion sur la période", "—"]] },
      { heading: "Connexions par jour", table: { head: ["Jour", "Connexions", "Comptes distincts"], rows: c.perDay.map((d) => [d.day, d.logins, d.users]) } },
      { heading: "Définitions et limites", paragraphs: c.notes },
    ],
  });
}
