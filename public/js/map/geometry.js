// Géométrie légère côté navigateur (sans DOM, testable sous Node).
// ATTENTION : ces calculs ne servent qu'à l'aperçu pendant le dessin (projection plane locale, très fiable à l'échelle d'une parcelle).
// La superficie et le périmètre OFFICIELS sont recalculés par le serveur (server/lib/geo.js) à l'enregistrement.
const A = 6_378_137; // ellipsoïde WGS84 : demi-grand axe (m)
const E2 = 0.006694379990141317; // première excentricité au carré
const rad = (d) => (d * Math.PI) / 180;

/** Mètres par degré vers l'est et vers le nord à la latitude donnée (rayons de courbure WGS84 locaux). */
function scales(latDeg) {
  const s = Math.sin(rad(latDeg));
  const w = 1 - E2 * s * s;
  const north = (A * (1 - E2)) / w ** 1.5; // rayon méridien
  const east = (A / Math.sqrt(w)) * Math.cos(rad(latDeg)); // rayon du parallèle
  return { x: (Math.PI / 180) * east, y: (Math.PI / 180) * north };
}

/** Projette un point {lat,lng} en mètres {x,y} autour d'un centre (y vers le nord). */
export function toLocal(center, p) {
  const k = scales(center.lat);
  return { x: (p.lng - center.lng) * k.x, y: (p.lat - center.lat) * k.y };
}

export function fromLocal(center, q) {
  const k = scales(center.lat);
  return { lat: center.lat + q.y / k.y, lng: center.lng + q.x / k.x };
}

export function centerOf(points) {
  const n = points.length || 1;
  return { lat: points.reduce((s, p) => s + p.lat, 0) / n, lng: points.reduce((s, p) => s + p.lng, 0) / n };
}

/** Aperçu de la superficie (m²) et du périmètre (m) d'un contour ouvert (le dernier côté est fermé automatiquement). */
export function preview(points) {
  if (points.length < 3) return { areaM2: 0, perimeterM: 0 };
  const c = centerOf(points);
  const xy = points.map((p) => toLocal(c, p));
  let twice = 0;
  let perimeter = 0;
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i];
    const b = xy[(i + 1) % xy.length];
    twice += a.x * b.y - b.x * a.y;
    perimeter += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return { areaM2: Math.abs(twice) / 2, perimeterM: perimeter };
}

const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Vrai si deux côtés non voisins du contour se croisent. */
export function selfIntersects(points) {
  const n = points.length;
  if (n < 4) return false;
  const c = centerOf(points);
  const xy = points.map((p) => toLocal(c, p));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue; // côtés voisins
      const a = xy[i], b = xy[(i + 1) % n], p = xy[j], q = xy[(j + 1) % n];
      if (cross(a, b, p) * cross(a, b, q) < 0 && cross(p, q, a) * cross(p, q, b) < 0) return true;
    }
  }
  return false;
}

/** Pas de grille « rond » (10, 20, 50, 100… mètres) pour une largeur visible donnée. */
export function niceStep(widthM) {
  const target = widthM / 5;
  const base = 10 ** Math.floor(Math.log10(target));
  return [1, 2, 5, 10].map((k) => k * base).find((s) => s >= target) ?? base * 10;
}

/** GeoJSON Polygon prêt à envoyer (contour fermé, [lng, lat]). */
export function toPolygon(points) {
  const ring = points.map((p) => [p.lng, p.lat]);
  ring.push([...ring[0]]);
  return { type: "Polygon", coordinates: [ring] };
}

export function fromPolygon(polygon) {
  const ring = polygon?.coordinates?.[0] ?? [];
  const pts = ring.map(([lng, lat]) => ({ lat, lng }));
  if (pts.length > 1 && pts[0].lat === pts.at(-1).lat && pts[0].lng === pts.at(-1).lng) pts.pop();
  return pts;
}

export const fmtM2 = (m2) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(m2)} m²`;
export const fmtHa = (m2) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 4 }).format(m2 / 10_000)} ha`;

// Retire le sommet d'index i (nouvelle liste ; liste inchangée si l'index est invalide).
export function removeVertex(vertices, i) {
  if (!Number.isInteger(i) || i < 0 || i >= vertices.length) return vertices;
  return vertices.filter((_, k) => k !== i);
}
