/**
 * Géométrie des biens : validation d'un point et d'un polygone (GeoJSON, WGS84), superficie et périmètre.
 *
 * Méthode (documentée pour la recette) :
 * - Coordonnées d'échange : WGS84 / EPSG:4326, GeoJSON [longitude, latitude], degrés décimaux.
 * - Superficie : projection équivalente (aire conservée) sur l'ellipsoïde WGS84 — latitude authalique q(φ),
 *   aire = (a²/2) · |formule du lacet appliquée à (λ, q)|. Les côtés sont des segments de cette projection ;
 *   pour une parcelle (quelques km au plus) l'écart avec des côtés géodésiques est négligeable.
 * - Périmètre : somme des côtés, chacun calculé avec les rayons de courbure locaux de l'ellipsoïde (M, N) à la latitude
 *   moyenne du côté. Précis pour des côtés de quelques km ; la taille d'une parcelle est limitée (MAX_EXTENT_DEG).
 * - Jamais de pixels d'écran : seules les coordonnées géographiques entrent dans le calcul.
 * Unités : superficie en m², hectares (m² / 10 000), périmètre en mètres.
 */

const A = 6378137; // demi-grand axe WGS84 (m)
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const E = Math.sqrt(E2);
const RAD = Math.PI / 180;

export const MAX_VERTICES = 500; // sommets distincts (hors point de fermeture)
export const MAX_EXTENT_DEG = 0.5; // une parcelle ne dépasse pas ~55 km d'étendue
const MIN_AREA_M2 = 0.01;

const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
const round7 = (v) => Math.round(v * 1e7) / 1e7; // ≈ 1 cm
const wrapDeg = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

/** Latitude authalique q(φ) de l'ellipsoïde. */
function authalicQ(phi) {
  const s = Math.sin(phi);
  return (1 - E2) * (s / (1 - E2 * s * s) - (1 / (2 * E)) * Math.log((1 - E * s) / (1 + E * s)));
}

export function validatePoint(input) {
  const lat = Number(input?.lat ?? input?.latitude);
  const lng = Number(input?.lng ?? input?.longitude);
  if (input == null || typeof input !== "object" || !Number.isFinite(lat) || !Number.isFinite(lng) || input?.lat === null || input?.lng === null) {
    throw new Error("Position invalide : latitude et longitude sont obligatoires.");
  }
  if (lat < -90 || lat > 90) throw new Error("Latitude invalide : elle doit être comprise entre -90 et 90.");
  if (lng < -180 || lng > 180) throw new Error("Longitude invalide : elle doit être comprise entre -180 et 180.");
  if (lat === 0 && lng === 0) throw new Error("Position invalide (0, 0) : placez le repère sur le bien.");
  return { lat: round7(lat), lng: round7(lng) };
}

/** Extrait l'anneau d'un Polygon GeoJSON (ou d'un Feature qui le contient). */
function extractRing(input) {
  let g = input;
  if (g && typeof g === "object" && g.type === "Feature") g = g.geometry;
  if (!g || typeof g !== "object" || g.type !== "Polygon" || !Array.isArray(g.coordinates)) {
    throw new Error("Délimitation invalide : un polygone GeoJSON (type Polygon) est attendu.");
  }
  if (g.coordinates.length !== 1) throw new Error("Une parcelle avec trou ou plusieurs contours n'est pas prise en charge : dessinez un seul contour.");
  const ring = g.coordinates[0];
  if (!Array.isArray(ring)) throw new Error("Délimitation invalide : contour illisible.");
  if (ring.length > MAX_VERTICES + 1) throw new Error(`Trop de sommets : ${MAX_VERTICES} au plus.`);
  return ring;
}

/** Coordonnées locales planes (degrés) relatives au premier sommet, longitudes recalées (passage du méridien ±180). */
function toLocal(vertices) {
  const [lng0] = vertices[0];
  return vertices.map(([lng, lat]) => [wrapDeg(lng - lng0), lat]);
}

const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const onSegment = (a, b, p) => Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1]);

function segmentsIntersect(p1, p2, p3, p4) {
  const d1 = cross(p3, p4, p1), d2 = cross(p3, p4, p2), d3 = cross(p1, p2, p3), d4 = cross(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  if (d1 === 0 && onSegment(p3, p4, p1)) return true;
  if (d2 === 0 && onSegment(p3, p4, p2)) return true;
  if (d3 === 0 && onSegment(p1, p2, p3)) return true;
  if (d4 === 0 && onSegment(p1, p2, p4)) return true;
  return false;
}

function hasSelfIntersection(local) {
  const n = local.length;
  for (let i = 0; i < n; i += 1) {
    const a1 = local[i], a2 = local[(i + 1) % n];
    for (let j = i + 1; j < n; j += 1) {
      const adjacent = j === i + 1 || (i === 0 && j === n - 1);
      const b1 = local[j], b2 = local[(j + 1) % n];
      if (adjacent) {
        // Côtés voisins : ils ne partagent qu'un sommet ; un retour en arrière (pointe) sur la même droite est invalide.
        const shared = j === i + 1 ? a2 : a1;
        const farA = j === i + 1 ? a1 : a2;
        const farB = j === i + 1 ? b2 : b1;
        if (cross(shared, farA, farB) === 0 && (farA[0] - shared[0]) * (farB[0] - shared[0]) + (farA[1] - shared[1]) * (farB[1] - shared[1]) > 0) return true;
        continue;
      }
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

/** Superficie en m² d'un contour (sommets sans point de fermeture) donné en [lng, lat]. */
export function areaM2(vertices) {
  const lng0 = vertices[0][0];
  const pts = vertices.map(([lng, lat]) => [wrapDeg(lng - lng0) * RAD, authalicQ(lat * RAD)]);
  let sum = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    sum += x1 * y2 - x2 * y1;
  }
  return (A * A / 2) * Math.abs(sum) / 2;
}

/** Longueur en mètres du contour fermé. */
export function perimeterM(vertices) {
  let total = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const [lng1, lat1] = vertices[i], [lng2, lat2] = vertices[(i + 1) % vertices.length];
    const phi = ((lat1 + lat2) / 2) * RAD;
    const w = 1 - E2 * Math.sin(phi) ** 2;
    const M = A * (1 - E2) / w ** 1.5;
    const N = A / Math.sqrt(w);
    const dy = M * (lat2 - lat1) * RAD;
    const dx = N * Math.cos(phi) * wrapDeg(lng2 - lng1) * RAD;
    total += Math.hypot(dx, dy);
  }
  return total;
}

function centroid(vertices) {
  const local = toLocal(vertices);
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < local.length; i += 1) {
    const [x1, y1] = local[i], [x2, y2] = local[(i + 1) % local.length];
    const k = x1 * y2 - x2 * y1;
    a += k; cx += (x1 + x2) * k; cy += (y1 + y2) * k;
  }
  if (Math.abs(a) < 1e-18) return { lat: vertices.reduce((s, v) => s + v[1], 0) / vertices.length, lng: vertices[0][0] };
  return { lat: round7(cy / (3 * a)), lng: round7(wrapDeg(vertices[0][0] + cx / (3 * a))) };
}

/**
 * Valide un polygone GeoJSON et calcule ses mesures. Lève une Error en français si la géométrie est invalide.
 * Un anneau non fermé est fermé automatiquement. Le contour renvoyé est fermé et orienté dans le sens antihoraire (RFC 7946).
 */
export function buildPolygon(input) {
  const raw = extractRing(input);
  let pts = raw.map((p) => {
    if (!Array.isArray(p) || p.length < 2 || typeof p[0] !== "number" || typeof p[1] !== "number" || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
      throw new Error("Délimitation invalide : chaque sommet doit être [longitude, latitude].");
    }
    if (p[1] < -90 || p[1] > 90 || p[0] < -180 || p[0] > 180) throw new Error("Délimitation invalide : un sommet est hors des limites géographiques.");
    return [round7(p[0]), round7(p[1])];
  });
  if (pts.length > 1 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts = pts.slice(0, -1); // retire le point de fermeture
  if (pts.length < 3) throw new Error("Une parcelle demande au moins 3 sommets distincts.");
  for (let i = 0; i < pts.length; i += 1) {
    const next = pts[(i + 1) % pts.length];
    if (pts[i][0] === next[0] && pts[i][1] === next[1]) throw new Error("Deux sommets consécutifs sont identiques : supprimez le doublon.");
  }
  const lats = pts.map((p) => p[1]);
  const lngLocal = toLocal(pts).map((p) => p[0]);
  if (Math.max(...lats) - Math.min(...lats) > MAX_EXTENT_DEG || Math.max(...lngLocal) - Math.min(...lngLocal) > MAX_EXTENT_DEG) {
    throw new Error("Contour trop étendu pour une parcelle : vérifiez les sommets.");
  }
  const flat = toLocal(pts);
  if (flat.every((q) => cross(flat[0], flat[1], q) === 0)) throw new Error("Surface nulle : les sommets sont alignés ou confondus.");
  if (hasSelfIntersection(flat)) throw new Error("Le contour se croise lui-même : corrigez l'ordre des sommets.");
  const area = areaM2(pts);
  if (!(area >= MIN_AREA_M2)) throw new Error("Surface nulle : les sommets sont alignés ou confondus.");
  // Orientation antihoraire (aire signée dans le plan local).
  const local = toLocal(pts);
  let signed = 0;
  for (let i = 0; i < local.length; i += 1) { const [x1, y1] = local[i], [x2, y2] = local[(i + 1) % local.length]; signed += x1 * y2 - x2 * y1; }
  if (signed < 0) pts.reverse();
  const perimeter = perimeterM(pts);
  return {
    polygon: { type: "Polygon", coordinates: [[...pts, pts[0]]] },
    vertexCount: pts.length,
    areaM2: round(area, 2),
    areaHa: round(area / 10_000, 4),
    perimeterM: round(perimeter, 2),
    centroid: centroid(pts),
  };
}

/**
 * Entrée du service : { point?: {lat, lng}, polygon?: GeoJSON, isPublic?: boolean }.
 * Il faut au moins un point ou un polygone ; sans point, le centre du polygone sert de repère.
 */
export function buildGeometry(input) {
  if (!input || typeof input !== "object") throw new Error("Données de localisation manquantes.");
  const hasPoint = input.point != null;
  const hasPolygon = input.polygon != null;
  if (!hasPoint && !hasPolygon) throw new Error("Indiquez une position, une délimitation, ou les deux.");
  const shape = hasPolygon ? buildPolygon(input.polygon) : null;
  const point = hasPoint ? validatePoint(input.point) : validatePoint(shape.centroid);
  return { point, shape, isPublic: input.isPublic === true };
}
