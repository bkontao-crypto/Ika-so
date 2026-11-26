// Habitudes de connexion (Super Administrateur) : fonctions pures, sans base. Source : journal de connexions (ika_security_log, LOGIN réussies).
// Heures en UTC, identiques à l'heure du Mali (UTC+0).
import { csvCell } from "./activity-feed.js";
import { buildPdf, fmtDate, fmtDateTime, fmtLong, fmtNumber } from "./simple-pdf.js";
import { brand } from "./brand.js";

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

/** PDF de synthèse aux couleurs de la marque : cartes d'indicateurs, graphiques (heures, jours), tableaux, définitions. */
export function connectionsToPdf(c, generatedAt) {
  const n = (v) => (v == null ? "—" : fmtNumber(v));
  const pct = (v) => (v == null ? "—" : `${String(v).replace(".", ",")} %`);
  const peak = c.peakHour;
  const dayLabel = (d) => `${d.slice(8)}/${d.slice(5, 7)}`;
  const busiestIdx = (() => { const max = Math.max(0, ...c.perDay.map((d) => d.logins)); return max > 0 ? c.perDay.findIndex((d) => d.logins === max) : -1; })();
  const devEntries = Object.entries(c.devices).sort((a, b) => b[1] - a[1]);
  const devTotal = devEntries.reduce((a, [, v]) => a + v, 0);
  const peakBucket = peak == null ? -1 : c.buckets.findIndex((b) => peak >= b.from && peak < b.to);
  return buildPdf({
    eyebrow: "Super Administrateur · Activité et sécurité",
    title: "Habitudes de connexion",
    subtitle: `Généré le ${fmtLong(generatedAt)} (UTC, identique à l'heure du Mali) · ${c.days} dernier(s) jour(s) · mesuré depuis le ${c.since ? fmtDate(c.since) : "—"}`,
    generatedAt, footer: brand() + " · Habitudes de connexion · document confidentiel",
    sections: [
      { heading: "Vue d'ensemble", caption: "Connexions réussies enregistrées au journal de sécurité du site.", kpis: { cols: 4, items: [
        { label: "Connexions réussies", value: n(c.totals.logins), sub: `sur ${c.days} jour(s)` },
        { label: "Connectés · 24 h", value: n(c.active.last24h), sub: "comptes distincts" }, { label: "Connectés · 7 jours", value: n(c.active.last7d), sub: "comptes distincts" }, { label: "Connectés · 30 jours", value: n(c.active.last30d), sub: "comptes distincts" },
        { label: "Sans connexion · 30 j", value: n(c.inactive.since30d), sub: "dernière connexion plus ancienne", tone: "warn" }, { label: "Sans connexion · 60 j", value: n(c.inactive.since60d), sub: "dernière connexion plus ancienne", tone: "warn" },
        { label: "Sans connexion · 90 j", value: n(c.inactive.since90d), sub: "dernière connexion plus ancienne", tone: "bad" }, { label: "Aucune connexion notée", value: n(c.neverLoggedIn), sub: c.accounts == null ? undefined : `sur ${n(c.accounts)} comptes`, tone: "warn" },
      ] } },
      { heading: "Rythme de la journée", caption: peak == null ? "Aucune connexion sur la période." : `Connexions par heure (UTC). Heure de pointe : ${String(peak).padStart(2, "0")} h, en doré.`, blocks: [
        { chart: { values: c.byHour, labels: c.byHour.map((_, i) => String(i)), highlight: peak ?? -1, labelEvery: 1, xTitle: "Heure de la journée (UTC)" } },
        { table: { head: ["Tranche horaire (UTC)", "Connexions", "Part du total"], widths: [2.2, 1, 1], align: ["l", "r", "r"], rows: c.buckets.map((b, i) => { const hi = i === peakBucket; const cell = (t) => (hi ? { t, c: "ok", b: true } : t); return [cell(b.label), cell(fmtNumber(b.count)), cell(pct(b.sharePct))]; }) } },
      ] },
      { heading: "Semaine et week-end", rows: [
        ["Lundi à vendredi", { t: `${fmtNumber(c.week.weekday)} · moyenne ${c.week.weekdayAvgPerDay == null ? "—" : String(c.week.weekdayAvgPerDay).replace(".", ",")} par jour` }],
        ["Samedi et dimanche", { t: `${fmtNumber(c.week.weekend)} · moyenne ${c.week.weekendAvgPerDay == null ? "—" : String(c.week.weekendAvgPerDay).replace(".", ",")} par jour` }],
        ["Jour le plus fréquenté", c.week.busiestDay ?? "—"],
      ] },
      { heading: "Appareils", blocks: devEntries.length
        ? [{ table: { head: ["Type d'appareil", "Connexions", "Part du total"], widths: [2.2, 1, 1], align: ["l", "r", "r"], rows: devEntries.map(([k, v]) => [k, fmtNumber(v), pct(devTotal ? Math.round((v / devTotal) * 1000) / 10 : null)]) } }]
        : [{ notes: ["Aucune connexion sur la période."] }] },
      { heading: "Connexions par jour", caption: busiestIdx >= 0 ? `Jour le plus chargé de la période : ${fmtDate(c.perDay[busiestIdx].day)}, en doré.` : "Aucune connexion sur la période.", blocks: [
        { chart: { values: c.perDay.map((d) => d.logins), labels: c.perDay.map((d) => dayLabel(d.day)), highlight: busiestIdx, labelEvery: Math.ceil(c.perDay.length / 14), xTitle: "Jour (jj/mm)" } },
        ...(c.perDay.length <= 31 ? [{ table: { head: ["Jour", "Connexions", "Comptes distincts"], widths: [2, 1, 1], align: ["l", "r", "r"], rows: c.perDay.map((d) => [fmtDate(d.day), fmtNumber(d.logins), fmtNumber(d.users)]) } }] : [{ notes: ["Le détail jour par jour est dans l'export CSV."] }]),
      ] },
      { heading: "Définitions et limites", notes: c.notes },
    ],
  });
}
