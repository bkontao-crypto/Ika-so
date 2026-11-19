// Habitudes de connexion (Super Administrateur) : fonctions pures, sans base. Source : journal de connexions (ika_security_log, LOGIN réussies).
// Heures en UTC, identiques à l'heure du Mali (UTC+0).

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
