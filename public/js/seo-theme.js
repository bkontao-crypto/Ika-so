// Thème des pages publiques rendues par le serveur (guides, quartiers, agences, annonces) : même choix que l'application (ika_theme).
// Externe et sans dépendance : la politique de sécurité interdit les scripts inline.
(function () {
  var theme = "light";
  try { var saved = localStorage.getItem("ika_theme"); if (saved === "dark" || saved === "light") theme = saved; } catch (e) { /* stockage bloqué : thème clair */ }
  var root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
})();

// Couleurs choisies dans l'administration : appliquées aux boutons seulement, avec un texte lisible calculé.
(function () {
  if (!window.fetch) return;
  function texte(hex) {
    var h = /^#([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!h) return null;
    var c = [0, 2, 4].map(function (i) { var v = parseInt(h[1].substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.179 ? "#04130c" : "#ffffff";
  }
  fetch("/api/superadmin-settings/public").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    var s = (d && (d.settings || d.value || d)) || {};
    var colors = s.colors || {};
    var style = document.documentElement.style;
    if (texte(colors.primary)) { style.setProperty("--s-btn", colors.primary); style.setProperty("--s-btn-ink", texte(colors.primary)); }
    if (texte(colors.accent)) { style.setProperty("--is-gold", colors.accent); style.setProperty("--on-gold", texte(colors.accent)); }
  }).catch(function () { /* réglages indisponibles : palette commune */ });
})();
