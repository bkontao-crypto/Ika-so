import { badRequest } from "../lib/errors.js";
import { IMPORT_MAX_BYTES, csvToListings } from "../lib/csv.js";
import { validateListing } from "../lib/rules.js";
import { normalizeText } from "../lib/search.js";
import { findSimilar } from "./duplicates.js";

export function createImports(ctx, accounts, listings) {
  const { db } = ctx;
  return {
    /**
     * Import CSV, tout ou rien : si une ligne est refusée, rien n'est créé et le rapport dit laquelle et pourquoi.
     * Les annonces importées passent par la modération comme les autres. `dryRun` : contrôle seulement.
     */
    async importCsv(userId, text, { dryRun = false } = {}) {
      // Contrôle du statut annonceur dès le contrôle à blanc (dryRun), pas seulement à la création.
      const profile = await accounts.assertCanPublishListing(userId);
      if (!profile.phone_verified_at) throw badRequest("Vérifiez votre numéro avant d'importer des annonces.");
      if (String(text ?? "").length > IMPORT_MAX_BYTES) throw badRequest("Fichier trop volumineux (400 Ko au plus).");
      const { items, problems } = csvToListings(text, { fullName: profile.full_name || "Annonceur", ownerRole: profile.display_role });
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
