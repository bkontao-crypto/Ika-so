/**
 * Quartiers et pays : liste vivante, remplie au démarrage depuis la base (tables ika_zones et ika_countries) et
 * rechargée après chaque changement du Superadmin. Les valeurs ci-dessous sont celles d'origine : elles servent
 * tant que la base n'a pas été lue (tests, première minute, migration 058 pas encore passée).
 * ZONES = quartiers proposés au public (quartier actif ET pays actif). ALL_ZONES = tous, pour retrouver la position d'une
 * ancienne annonce dont le quartier a été masqué depuis. Les tableaux sont modifiés en place : les importations restent valables.
 */
const DEFAULT_ZONES = [
    { name: "ACI 2000", lat: 12.616, lng: -8.024 },
    { name: "Badalabougou", lat: 12.612, lng: -7.986 },
    { name: "Korofina", lat: 12.662, lng: -7.992 },
    { name: "Hamdallaye", lat: 12.649, lng: -8.016 },
    { name: "Yirimadio", lat: 12.608, lng: -7.958 },
    { name: "Bacodjicoroni", lat: 12.582, lng: -8.018 },
    { name: "Sébénikoro", lat: 12.574, lng: -8.078 },
    { name: "Kalaban Coura", lat: 12.578, lng: -7.978 },
    { name: "Sotuba", lat: 12.648, lng: -7.928 },
    { name: "Kati", lat: 12.745, lng: -8.072 },
].map((z) => ({ ...z, country: "ML" }));
export const COUNTRIES = [{ code: "ML", name: "Mali", currency: "XOF", timezone: "Africa/Bamako" }];
export const ZONES = DEFAULT_ZONES.map((z) => ({ ...z }));
export const ALL_ZONES = DEFAULT_ZONES.map((z) => ({ ...z }));
/** Remplace les listes (en place). `countries` : pays actifs ; `zones` : tous les quartiers { name, lat, lng, country, active }. */
export function applyPlaces({ countries, zones }) {
    if (Array.isArray(countries) && countries.length) COUNTRIES.splice(0, COUNTRIES.length, ...countries);
    if (Array.isArray(zones)) {
        const open = new Set(COUNTRIES.map((c) => c.code));
        ALL_ZONES.splice(0, ALL_ZONES.length, ...zones);
        ZONES.splice(0, ZONES.length, ...zones.filter((z) => z.active !== false && open.has(z.country)));
    }
}
/** Pays d'une annonce : vide → premier pays actif ; inconnu ou désactivé → null (refus). */
export function resolveCountry(code) {
    const c = String(code ?? "").trim().toUpperCase();
    if (!c) return COUNTRIES[0]?.code ?? "ML";
    return COUNTRIES.some((x) => x.code === c) ? c : null;
}
export const PHOTO_PRESETS = [
    { id: "terrain-aci", label: "Terrain viabilisé", url: "/media/terrain-aci.jpg" },
    { id: "villa", label: "Villa", url: "/media/villa-badala.jpg" },
    { id: "appart", label: "Appartement", url: "/media/appart-hamdallaye.jpg" },
    { id: "terrain-yiri", label: "Parcelle de quartier", url: "/media/terrain-yiri.jpg" },
];
export function zonePoint(name) {
    return ALL_ZONES.find((z) => z.name === name) ?? null;
}
