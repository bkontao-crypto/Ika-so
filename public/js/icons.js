// Icônes SVG en ligne (aucune dépendance, aucune requête réseau). Trait 2 px, couleur = celle du texte (currentColor) :
// elles suivent donc la palette sans changement. Dessinées sur une grille de 24 × 24.
const P = {
  inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.5 5.1L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.5-6.9A2 2 0 0016.8 4H7.2a2 2 0 00-1.7 1.1z",
  "calendar-check": "M8 2v4M16 2v4M3 6h18v15H3zM3 10h18M9 16l2 2 4-4",
  "calendar-plus": "M8 2v4M16 2v4M3 6h18v15H3zM3 10h18M12 13v6M9 16h6",
  "calendar-clock": "M8 2v4M16 2v4M3 6h18v6M3 10h18M17 22a5 5 0 100-10 5 5 0 000 10zM17 14.5V17l1.5 1",
  "check-check": "M18 6L7 17l-5-5M22 10l-7.5 7.5L13 16",
  "bell-off": "M8.7 3A6 6 0 0118 8c0 2.7.6 4.5 1.3 5.7M17 17H3s3-2 3-9c0-.5.1-1 .2-1.5M10.3 21a2 2 0 003.4 0M2 2l20 20",
  "bell-ring": "M6 16v-5a6 6 0 1112 0v5l2 2H4zM10 21h4M2 8c0-2.2.7-4.3 2-6M22 8a10 10 0 00-2-6",
  sparkles: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  "arrow-right": "M5 12h14M13 6l6 6-6 6",
  "circle-dot": "M12 3a9 9 0 100 18 9 9 0 000-18zM12 10a2 2 0 100 4 2 2 0 000-4z",
  "check-circle": "M12 3a9 9 0 100 18 9 9 0 000-18zM8.5 12l2.5 2.5 4.5-5",
  "message-circle": "M4 20l1.3-4A8 8 0 1112 20a8 8 0 01-3.5-.8z",
  home: "M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6",
  store: "M4 9l1.5-5h13L20 9M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0A2.7 2.7 0 0020 9M5 12v8h14v-8M10 20v-5h4v5",
  briefcase: "M4 8h16v11H4zM9 8V5h6v3M4 13h16M11 13h2",
  heart: "M12 20s-7-4.4-9-9.2C1.8 7.6 3.6 4.5 6.8 4.5c2 0 3.5 1.1 5.2 3 1.7-1.9 3.2-3 5.2-3 3.2 0 5 3.1 3.8 6.3C19 15.6 12 20 12 20z",
  plus: "M12 5v14M5 12h14",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  message: "M4 5h16v11H9l-5 4z",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-7 8-7s8 3 8 7",
  users: "M9 11a3 3 0 100-6 3 3 0 000 6zM3 19c0-3 2.7-5 6-5s6 2 6 5M16 5a3 3 0 010 6M17 14c2.5.4 4 2.3 4 5",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  "shield-check": "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4",
  bell: "M6 16v-5a6 6 0 1112 0v5l2 2H4zM10 21h4",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  share: "M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zM18 22a3 3 0 100-6 3 3 0 000 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  pin: "M12 21s7-6 7-12a7 7 0 10-14 0c0 6 7 12 7 12zM12 11a2 2 0 100-4 2 2 0 000 4z",
  building: "M5 21V4h9v17M14 9h5v12M8 8h3M8 12h3M8 16h3M3 21h18",
  file: "M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  download: "M12 4v12M7 11l5 5 5-5M4 20h16",
  check: "M5 12l5 5 9-10",
  x: "M6 6l12 12M18 6L6 18",
  "arrow-left": "M19 12H5M11 6l-6 6 6 6",
  "chevron-down": "M6 9l6 6 6-6",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  tag: "M3 12V3h9l9 9-9 9zM7.5 7.5h.01",
  ruler: "M3 17L17 3l4 4L7 21zM8 12l2 2M11 9l2 2M14 6l2 2",
  bed: "M3 18V6M3 14h18v4M21 14v-3a3 3 0 00-3-3h-7v6",
  bath: "M4 12h16v3a4 4 0 01-4 4H8a4 4 0 01-4-4zM6 12V6a2 2 0 014-1M7 19l-1 2M17 19l1 2",
  road: "M8 3L5 21M16 3l3 18M12 4v3M12 10v4M12 17v3",
  sofa: "M5 11V8a3 3 0 013-3h8a3 3 0 013 3v3M3 13a2 2 0 014 0v2h10v-2a2 2 0 014 0v5H3zM6 18v2M18 18v2",
  lock: "M6 11h12v10H6zM8 11V8a4 4 0 018 0v3",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z",
  edit: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
  sliders: "M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  card: "M3 6h18v12H3zM3 10h18M7 15h3",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  chart: "M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8",
  journal: "M5 4h14v16H5zM9 9h6M9 13h6",
  globe: "M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  alert: "M12 4l9 16H3zM12 10v4M12 17v.01",
  ban: "M12 21a9 9 0 100-18 9 9 0 000 18zM6 6l12 12",
  print: "M7 9V3h10v6M6 17H4v-7h16v7h-2M7 14h10v7H7z",
  image: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M9 9h.01",
  send: "M21 3L10 14M21 3l-7 18-4-7-7-4z",
  refresh: "M20 12a8 8 0 10-3 6.2M20 5v5h-5",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v6M12 7.5v.01",
  key: "M7 16a4 4 0 100-8 4 4 0 000 8zM11 12h10M17 12v3M21 12v2",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14",
};

export const ICON_NAMES = Object.keys(P);
const NS = "http://www.w3.org/2000/svg";

/** Icône décorative (lue par personne : le texte à côté porte le sens). `name` inconnu → null. */
export function icon(name, cls = "") {
  const d = P[name];
  if (!d) return null;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", `ic${cls ? ` ${cls}` : ""}`);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", d);
  svg.append(path);
  return svg;
}
