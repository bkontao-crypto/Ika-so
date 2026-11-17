import { badRequest } from "../lib/errors.js";
import { IMPORT_MAX_BYTES, csvTemplate, csvToListings, parseCsv, rowsToListings } from "../lib/csv.js";
import { buildXlsx, readXlsxRows } from "../lib/xlsx.js";
import { CATEGORIES, DOCUMENTS, ROAD_ACCESS, TRANSACTIONS, validateListing } from "../lib/rules.js";
import { ZONES } from "../lib/places.js";
import { normalizeText } from "../lib/search.js";
import { findSimilar } from "./duplicates.js";

export function createImports(ctx, accounts, listings) {
  const { db } = ctx;
  return {
    /** Droit d'importer : annonceur approuvé (ou équipe) et numéro vérifié par SMS. Même règle pour le modèle, le contrôle et l'import. */
    async assertCanImport(userId) {
      const profile = await accounts.assertCanPublishListing(userId);
      if (!profile.phone_verified_at) throw badRequest("Vérifiez votre numéro avant d'importer des annonces.");
      return profile;
    },

    /** Indique à l'interface si le bouton d'import peut être activé, et pourquoi sinon. */
    async importStatus(userId) {
      try {
        await this.assertCanImport(userId);
        return { canImport: true, reason: null };
      } catch (error) {
        return { canImport: false, reason: error.message ?? "Import indisponible pour ce compte." };
      }
    },

    /** Import CSV, tout ou rien : si une ligne est refusée, rien n'est créé et le rapport dit laquelle et pourquoi. */
    async importCsv(userId, text, { dryRun = false } = {}) {
      // Contrôle du statut annonceur dès le contrôle à blanc (dryRun), pas seulement à la création.
      const profile = await this.assertCanImport(userId);
      if (String(text ?? "").length > IMPORT_MAX_BYTES) throw badRequest("Fichier trop volumineux (400 Ko au plus).");
      return this.importParsed(userId, profile, csvToListings(text, { fullName: profile.full_name || "Annonceur", ownerRole: profile.display_role }), { dryRun });
    },

    /** Import Excel (.xlsx) : mêmes règles, même rapport et même traitement que le CSV. `buffer` : fichier brut. */
    async importXlsx(userId, buffer, { dryRun = false } = {}) {
      const profile = await this.assertCanImport(userId);
      const rows = readXlsxRows(buffer);
      return this.importParsed(userId, profile, rowsToListings(rows, { fullName: profile.full_name || "Annonceur", ownerRole: profile.display_role }), { dryRun });
    },

    /** Modèle Excel à remplir : feuille « Annonces » (en-têtes et deux exemples valides) et feuille « Valeurs acceptées ». */
    modeleXlsx() {
      const [header, ...examples] = parseCsv(csvTemplate());
      const aide = [
        ["Colonne", "Valeurs acceptées ou format attendu", "Obligatoire"],
        ["titre", "Texte court, unique parmi vos annonces actives", "Oui"],
        ["description", "Texte libre décrivant le bien", "Non"],
        ["type", CATEGORIES.join(" ; "), "Oui"],
        ["transaction", TRANSACTIONS.join(" ; "), "Oui"],
        ["quartier", ZONES.map((z) => z.name).join(" ; "), "Oui"],
        ["prix", "Nombre en FCFA, sans espaces (ex. 45000000)", "Oui"],
        ["superficie", "Texte libre (ex. 500 m²)", "Non"],
        ["superficie m2", "Nombre entier en m² (ex. 500)", "Non"],
        ["acces routier", `${ROAD_ACCESS.join(" ; ")} (terrains seulement)`, "Non"],
        ["chambres", "Nombre entier (habitations seulement)", "Non"],
        ["salles de bain", "Nombre entier (habitations seulement)", "Non"],
        ["meuble", "oui ou non (habitations seulement)", "Non"],
        ["document", DOCUMENTS.join(" ; "), "Non"],
        [],
        ["Les annonces importées passent par la modération avant publication."],
        ["Gardez la première ligne (en-têtes). Un fichier refusé ne crée aucune annonce : le rapport indique la ligne et la raison."],
      ];
      return buildXlsx([
        { name: "Annonces", rows: [header, ...examples], widths: [40, 50, 14, 14, 16, 14, 14, 14, 16, 11, 14, 10, 18] },
        { name: "Valeurs acceptées", rows: aide, widths: [18, 90, 12] },
      ]);
    },

    /** Traitement commun CSV et Excel : contrôle de chaque ligne, puis création de toutes les annonces ou d'aucune. */
    async importParsed(userId, profile, { items, problems }, { dryRun = false } = {}) {
      const errors = problems.filter((p) => p.line !== 1 || !/ignorée/.test(p.message)).map((p) => ({ ...p }));
      const warnings = problems.filter((p) => p.line === 1 && /ignorée/.test(p.message));
      const seen = new Map();
      for (const { line, input } of items) {
        const key = normalizeText(input.title);
        const list = validateListing({ ...input, title: input.title ?? "", description: input.description ?? "", neighborhood: input.neighborhood ?? "", surfaceLabel: input.surfaceLabel ?? "" });
        for (const message of list) errors.push({ line, message });
        if (seen.has(key)) errors.push({ line, message: `Titre déjà utilisé à la ligne ${seen.get(key)}.` });
        else seen.set(key, line);
      }
      if (items.length) {
        const existing = await db.query(
          "select ika_norm(title) as t from ika_listings where owner_id = $1 and status in ('PENDING','PUBLISHED') and ika_norm(title) = any($2::text[])",
          [userId, [...seen.keys()]],
        );
        const taken = new Set(existing.map((r) => r.t));
        for (const [key, line] of seen) if (taken.has(key)) errors.push({ line, message: "Vous avez déjà une annonce active avec ce titre." });
      }
      errors.sort((a, b) => a.line - b.line);
      const result = { total: items.length, created: 0, errors, warnings, similar: 0, dryRun };
      if (errors.length || dryRun || !items.length) return result;
      for (const { input } of items) {
        const r = await listings.create(userId, input, { bulk: true });
        result.created += 1;
        result.similar += r.similarCount ? 1 : 0;
      }
      await accounts.audit(userId, "IMPORT_CSV", null, `${result.created} annonce(s)`);
      return result;
    },

    /** Tableau de bord de l'espace agence : annonces par statut, contacts des 7 derniers jours, par annonce. */
    async agencyStats(userId) {
      await accounts.requireActive(userId);
      const status = await db.query("select status, count(*)::int as n from ika_listings where owner_id = $1 group by status", [userId]);
      const contacts = await db.query(
        `select l.id, l.title, l.status, count(c.id) filter (where c.created_at > now() - interval '7 days')::int as contacts7d, count(c.id)::int as contacts
         from ika_listings l left join ika_contact_events c on c.listing_id = l.id
         where l.owner_id = $1 and l.status in ('PUBLISHED','PENDING') group by l.id order by contacts7d desc, l.created_at desc limit 50`,
        [userId],
      );
      const profile = await accounts.ensureProfile(userId);
      return {
        byStatus: Object.fromEntries(status.map((r) => [r.status, r.n])),
        listings: contacts.map((r) => ({ id: r.id, title: r.title, status: r.status, contacts7d: r.contacts7d, contacts: r.contacts })),
        agencyVerified: Boolean(profile.agency_verified_at), agencyName: profile.agency_name ?? null, publicPage: profile.agency_verified_at ? `/agence/${userId}` : null,
      };
    },
  };
}
