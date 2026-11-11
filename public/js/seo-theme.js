// Thème des pages publiques rendues par le serveur (guides, quartiers, agences, annonces) : même choix que l'application (ika_theme).
// Externe et sans dépendance : la politique de sécurité interdit les scripts inline.
(function () {
  var theme = "light";
  try { var saved = localStorage.getItem("ika_theme"); if (saved === "dark" || saved === "light") theme = saved; } catch (e) { /* stockage bloqué : thème clair */ }
  var root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
})();
