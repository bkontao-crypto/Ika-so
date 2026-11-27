// Utilisateurs & comptes : graphiques de synthèse (anneaux et barres) affichés sous les indicateurs.
// Lecture seule de /staff/owner/users/aggregates ; n'altere pas l'annuaire ni le centre d'analyse (v-users.js).
import { api, h, panel, bars, nf } from "./ui.js";
import { donut } from "./charts-modern.js";

export function usersInsights() {
  const box = h("section", { class: "grid ins" });
  (async () => {
    try {
      const a = await api("/staff/owner/users/aggregates");
      const s = a.segments ?? {}; const f = a.frequency ?? {}; const sa = a.sanctions ?? {}; const u = a.usage ?? {};
      const blocked = (sa.banned || 0) + (sa.restricted || 0);
      box.replaceChildren(
        panel("Activité des comptes", "Selon la dernière connexion", donut({ center: nf(a.total), caption: "comptes", items: [
          { label: "Actifs", value: s.active || 0, color: "#087448" }, { label: "En veille", value: s.standby || 0, color: "#c6a35c" },
          { label: "Inactifs", value: s.inactive || 0, color: "#c94f4f" }, { label: "Jamais connectés", value: s.never || 0, color: "#9fb3a8" }] })),
        panel("Fréquence de connexion", "Comptes actifs, sur 30 jours", donut({ caption: "comptes", items: [
          { label: "Assidus (12+)", value: f.high || 0, color: "#087448" }, { label: "Réguliers (4–11)", value: f.mid || 0, color: "#477eaa" }, { label: "Rares (1–3)", value: f.low || 0, color: "#c6a35c" }] })),
        panel("État des comptes", "Sanctions en cours", donut({ caption: "comptes", items: [
          { label: "Sans sanction", value: Math.max(0, (a.total || 0) - blocked), color: "#087448" }, { label: "Restreints", value: sa.restricted || 0, color: "#c6a35c" }, { label: "Bloqués", value: sa.banned || 0, color: "#c94f4f" }] })),
        panel("Utilisation du site", "Visiteurs connectés", bars([{ label: "24 heures", value: u.dau || 0 }, { label: "7 jours", value: u.wau || 0 }, { label: "30 jours", value: u.mau || 0 }], { color: "#477eaa" })));
    } catch { box.replaceChildren(); /* l'erreur est déjà affichée par les indicateurs */ }
  })();
  return box;
}
