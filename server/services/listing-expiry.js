// Durée de publication : expiration, avertissements, archivage automatique, actions du propriétaire, supervision Superadmin.
// Les décisions de masquage sont prises ici, côté serveur : une annonce échue passe en EXPIRED, hors de tout résultat public.
import { asBadRequest, badRequest, conflict, notFound } from "../lib/errors.js";
import {
  DAY_MS, EXPIRY_KEY, applicableWarningDays, daysLeft, dayString, displayStatus, endOfDay,
  normalizeExpirySettings, resolveExtension, validatePublicationDates, warningKind,
} from "../lib/expiry.js";

const LOCK = 727010; // un seul traitement à la fois, même avec plusieurs instances
const OUTCOMES = ["SOLD", "RENTED", "ARCHIVED", "RENEW"];
const iso = (v) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

export function createListingExpiry({ db, accounts, settings, engagement = null, moderationAudit = null, now = () => Date.now() }) {
  async function getSettings() {
    const raw = await settings.get(EXPIRY_KEY).catch(() => null);
    return normalizeExpirySettings(raw);
  }

  /** Une ligne d'historique : qui (propriétaire, équipe ou système), quoi, ancienne et nouvelle valeur. */
  async function event(q, listingId, actor, action, oldValue = null, newValue = null) {
    await q.query(
      "insert into ika_listing_events (listing_id, actor_id, actor_kind, action, old_value, new_value) values ($1,$2,$3,$4,$5,$6)",
      [listingId, actor?.id ?? null, actor?.kind ?? "SYSTEM", action, oldValue == null ? null : String(oldValue).slice(0, 200), newValue == null ? null : String(newValue).slice(0, 200)],
    );
  }
  const SYSTEM = { id: null, kind: "SYSTEM" };

  async function notifySafe(userId, note) {
    try { await engagement?.notify(userId, note); } catch { /* l'alerte à la connexion reste disponible */ }
  }

  /** Filtres de la supervision (valeurs en paramètres, jamais dans le texte SQL). */
  function filterSql(f, params) {
    const w = [];
    const add = (sql, value) => { params.push(value); w.push(sql.replace("?", `$${params.length}`)); };
    if (f.ownerId) add("l.owner_id = ?", String(f.ownerId).slice(0, 80));
    if (f.category) add("l.category = ?", String(f.category).slice(0, 40));
    if (f.transaction === "Vente" || f.transaction === "Location") add("l.transaction_type = ?", f.transaction);
    if (f.status) add("l.status = ?", String(f.status).slice(0, 20));
    if (f.from && !Number.isNaN(Date.parse(f.from))) add("l.expires_at >= ?::timestamptz", f.from);
    if (f.to && !Number.isNaN(Date.parse(f.to))) add("l.expires_at <= ?::timestamptz", f.to);
    return w;
  }

  return {
    getSettings,

    async saveSettings(staffId, raw) {
      await accounts.requireStaff(staffId, "SUPERADMIN");
      const before = await getSettings();
      const next = asBadRequest(() => normalizeExpirySettings(raw, { strict: true, base: before }));
      await settings.set(staffId, EXPIRY_KEY, next);
      await moderationAudit?.log(staffId, { action: "expiry_settings_update", targetType: "settings", targetId: EXPIRY_KEY, details: { before, after: next } }).catch(() => {});
      return next;
    },

    /**
     * Tâche automatique (appelée toutes les minutes). Sûre en cas de redémarrage et de lancements simultanés :
     * verrou en base, chaque transition ne s'applique qu'une fois (UPDATE ... WHERE statut d'origine), chaque avertissement est unique.
     */
    async runDue() {
      const cfg = await getSettings();
      const nowMs = now();
      const out = { started: [], expired: [], archived: [], warned: [] };
      await db.transaction(async (tx) => {
        const lock = await tx.query("select pg_try_advisory_xact_lock($1) as ok", [LOCK]);
        if (!lock[0]?.ok) return;

        // 1. Début de publication des annonces programmées.
        const started = await tx.query(
          `update ika_listings set status = 'PUBLISHED', published_at = now(), updated_at = now()
           where status = 'SCHEDULED' and starts_at <= now() and (expires_at is null or expires_at > now())
           returning id, owner_id, title`,
        );
        for (const l of started) { await event(tx, l.id, SYSTEM, "PUBLICATION_START", "SCHEDULED", "PUBLISHED"); out.started.push(l); }

        // 2. Expiration : retrait immédiat de tout espace public (le statut sort de PUBLISHED), à la une retirée, données conservées.
        const expired = await tx.query(
          `update ika_listings set status = 'EXPIRED', expired_at = now(), featured_until = null, updated_at = now()
           where status in ('PUBLISHED', 'SCHEDULED') and expires_at is not null and expires_at <= now()
             and (status = 'PUBLISHED' or starts_at <= now())
           returning id, owner_id, title, expires_at`,
        );
        for (const l of expired) {
          await event(tx, l.id, SYSTEM, "EXPIRE", "PUBLISHED", "EXPIRED");
          let notify = false;
          if (cfg.dayZeroWarning) {
            const r = await tx.query(
              "insert into ika_expiry_warnings (listing_id, owner_id, kind, due_at) values ($1,$2,'DAY_0',$3) on conflict do nothing returning kind",
              [l.id, l.owner_id, l.expires_at],
            );
            if (r[0]) { await event(tx, l.id, SYSTEM, "WARNING_SENT", null, "DAY_0"); notify = true; }
          }
          out.expired.push({ ...l, notify });
        }

        // 3. Archivage automatique : jamais de suppression, seulement un changement de statut daté et distingué du manuel.
        const archived = await tx.query(
          `update ika_listings set status = 'ARCHIVED', archived_mode = 'AUTO', archived_at = now(), updated_at = now()
           where status = 'EXPIRED' and coalesce(expired_at, updated_at) <= now() - ($1::int * interval '1 day')
           returning id, owner_id, title`,
          [cfg.autoArchiveDays],
        );
        for (const l of archived) { await event(tx, l.id, SYSTEM, "ARCHIVE_AUTO", "EXPIRED", "ARCHIVED"); out.archived.push(l); }

        // 4. Avertissements avant échéance : un seul message par annonce, par palier et par date de fin.
        if (cfg.warningsEnabled && cfg.warningDays.length) {
          const widest = Math.max(...cfg.warningDays);
          const due = await tx.query(
            `select id, owner_id, title, expires_at from ika_listings
             where status = 'PUBLISHED' and expires_at > now() and expires_at <= now() + ($1::int * interval '1 day')
             order by expires_at asc limit 1000`,
            [widest],
          );
          for (const l of due) {
            const days = applicableWarningDays(new Date(l.expires_at).getTime(), nowMs, cfg.warningDays);
            const fresh = [];
            for (const d of days) {
              const r = await tx.query(
                "insert into ika_expiry_warnings (listing_id, owner_id, kind, due_at) values ($1,$2,$3,$4) on conflict do nothing returning kind",
                [l.id, l.owner_id, warningKind(d), l.expires_at],
              );
              if (r[0]) fresh.push(d);
            }
            // Plusieurs paliers franchis d'un coup (ex. annonce ayant déjà 2 jours) : un seul message, le plus proche.
            if (fresh.length) {
              const tightest = Math.min(...fresh);
              await event(tx, l.id, SYSTEM, "WARNING_SENT", null, warningKind(tightest));
              out.warned.push({ ...l, days: tightest });
            }
          }
        }
      });
      // Messages et alertes de recherche : après validation de la transaction (un échec n'annule aucune transition).
      for (const l of out.started) await Promise.resolve(engagement?.onPublished?.(l.id)).catch(() => {});
      for (const l of out.expired) {
        if (l.notify) await notifySafe(l.owner_id, { kind: "LISTING_EXPIRED", title: `Annonce expirée : ${l.title}`, body: "Elle n'est plus visible. Marquez-la, prolongez-la ou archivez-la.", link: "#/mes-annonces" });
      }
      for (const l of out.warned) {
        await notifySafe(l.owner_id, { kind: "LISTING_EXPIRY_WARNING", title: `Votre annonce expire dans ${l.days} jour${l.days > 1 ? "s" : ""} : ${l.title}`, body: "Prolongez-la ou marquez-la vendue ou louée.", link: "#/mes-annonces" });
      }
      return { started: out.started.length, expired: out.expired.length, archived: out.archived.length, warned: out.warned.length };
    },

    /** Fenêtre d'alerte à la connexion : annonces proches de l'échéance, échues, ou à traiter. Vide = rien à afficher. */
    async ownerAlerts(userId) {
      await accounts.requireActive(userId);
      const cfg = await getSettings();
      const nowMs = now();
      const window = Math.max(0, ...cfg.warningDays) || 7;
      const rows = await db.query(
        `select id, title, transaction_type, image_url, status, expires_at, expired_at from ika_listings
         where owner_id = $1 and (status = 'EXPIRED'
            or (status = 'PUBLISHED' and expires_at is not null and expires_at <= now() + ($2::int * interval '1 day')))
         order by expires_at asc nulls last limit 100`,
        [userId, window],
      );
      return rows.map((r) => {
        const expiresMs = r.expires_at ? new Date(r.expires_at).getTime() : null;
        const expired = r.status === "EXPIRED" || (expiresMs != null && expiresMs <= nowMs);
        const sinceMs = r.expired_at ? new Date(r.expired_at).getTime() : expiresMs;
        return {
          id: r.id, reference: r.id, title: r.title, imageUrl: r.image_url, transactionType: r.transaction_type,
          state: expired ? "EXPIRED" : "EXPIRING", expiresAt: iso(r.expires_at),
          days: expiresMs == null ? null : expired ? Math.floor((nowMs - expiresMs) / DAY_MS) : daysLeft(expiresMs, nowMs),
          autoArchiveAt: expired && sinceMs != null ? new Date(sinceMs + cfg.autoArchiveDays * DAY_MS).toISOString() : null,
          actions: [r.transaction_type === "Location" ? "RENTED" : "SOLD", "ARCHIVED", "RENEW"],
        };
      });
    },

    /** Vendu / Louée / Archiver / Prolonger, avec les règles du cahier des charges, appliquées côté serveur et tracées. */
    async outcome(userId, id, { outcome, until = null, days = null } = {}) {
      await accounts.requireActive(userId);
      if (!OUTCOMES.includes(outcome)) throw badRequest("Action inconnue.");
      const cfg = await getSettings();
      const nowMs = now();
      const actor = { id: userId, kind: "OWNER" };
      return db.transaction(async (tx) => {
        const row = (await tx.query(
          "select id, status, transaction_type, expires_at from ika_listings where id = $1 and owner_id = $2 for update",
          [String(id).slice(0, 80), userId],
        ))[0];
        if (!row) throw notFound("Annonce introuvable.");
        if (outcome === "SOLD" || outcome === "RENTED") {
          if (outcome === "SOLD" && row.transaction_type !== "Vente") throw conflict("Seule une annonce de vente peut être marquée vendue.");
          if (outcome === "RENTED" && row.transaction_type !== "Location") throw conflict("Seule une annonce de location peut être marquée louée.");
          if (!["PUBLISHED", "EXPIRED"].includes(row.status)) throw conflict("Cette annonce ne peut pas être marquée dans son état actuel.");
          await tx.query("update ika_listings set status = $2, featured_until = null, updated_at = now() where id = $1", [row.id, outcome]);
          await event(tx, row.id, actor, outcome, row.status, outcome);
          return { ok: true, status: outcome };
        }
        if (outcome === "ARCHIVED") {
          if (row.status === "ARCHIVED") throw conflict("Cette annonce est déjà archivée.");
          await tx.query(
            "update ika_listings set status = 'ARCHIVED', archived_mode = 'MANUAL', archived_at = now(), featured_until = null, updated_at = now() where id = $1",
            [row.id],
          );
          await event(tx, row.id, actor, "ARCHIVE_MANUAL", row.status, "ARCHIVED");
          return { ok: true, status: "ARCHIVED" };
        }
        // Prolongation : 30 jours au plus par opération, comptés depuis la validation réelle, annonce publiée ou expirée.
        if (!["PUBLISHED", "EXPIRED"].includes(row.status)) throw conflict("Seule une annonce publiée ou expirée se prolonge.");
        const ext = asBadRequest(() => resolveExtension({ nowMs, until, days, maxDays: cfg.maxExtensionDays }));
        await tx.query(
          "update ika_listings set status = 'PUBLISHED', expires_at = $2, expired_at = null, updated_at = now() where id = $1",
          [row.id, ext.expiresAt.toISOString()],
        );
        await event(tx, row.id, actor, "EXTEND", iso(row.expires_at), ext.expiresAt.toISOString());
        return { ok: true, status: "PUBLISHED", expiresAt: ext.expiresAt.toISOString() };
      });
    },

    /** Dates actuelles d'une annonce du propriétaire (pré-remplissage du formulaire). */
    async ownDates(userId, id) {
      const r = (await db.query("select status, starts_at, expires_at from ika_listings where id = $1 and owner_id = $2", [String(id).slice(0, 80), userId]))[0];
      if (!r) throw notFound("Annonce introuvable.");
      return { status: r.status, startsAt: iso(r.starts_at), expiresAt: iso(r.expires_at) };
    },

    /** Dates de début et de fin saisies à la publication ou à la modification (contrôlées ici, jamais seulement dans le navigateur). */
    async setDates(userId, id, { startsAt = null, expiresAt = null } = {}) {
      await accounts.requireActive(userId);
      const cfg = await getSettings();
      const nowMs = now();
      const clean = asBadRequest(() => validatePublicationDates({ startsAt, expiresAt }, nowMs));
      const actor = { id: userId, kind: "OWNER" };
      return db.transaction(async (tx) => {
        const row = (await tx.query(
          "select id, status, starts_at, expires_at from ika_listings where id = $1 and owner_id = $2 for update",
          [String(id).slice(0, 80), userId],
        ))[0];
        if (!row) throw notFound("Annonce introuvable.");
        if (!["DRAFT", "PENDING", "REJECTED", "SCHEDULED", "PUBLISHED"].includes(row.status)) {
          throw conflict("Les dates de cette annonce ne se modifient plus (utilisez « Prolonger » pour une annonce expirée).");
        }
        let nextStart = clean.startsAt;
        if (row.status === "PUBLISHED") {
          nextStart = row.starts_at ? new Date(row.starts_at) : null; // le début d'une annonce déjà en ligne ne bouge plus
          if (!clean.expiresAt) throw badRequest("Une annonce en ligne garde une date de fin.");
          const limit = endOfDay(dayString(nowMs + cfg.maxExtensionDays * DAY_MS));
          const current = row.expires_at ? new Date(row.expires_at).getTime() : null;
          if (clean.expiresAt.getTime() > limit && (current == null || clean.expiresAt.getTime() > current)) {
            throw badRequest(`Pour une annonce en ligne, la date de fin ne peut pas dépasser ${cfg.maxExtensionDays} jours à partir d'aujourd'hui. Utilisez « Prolonger ».`);
          }
        }
        if (row.status === "SCHEDULED") {
          if (!clean.startsAt || clean.startsAt.getTime() <= nowMs) throw badRequest("La date de début d'une annonce programmée doit être dans le futur.");
        }
        await tx.query("update ika_listings set starts_at = $2, expires_at = $3, updated_at = now() where id = $1", [row.id, nextStart ? nextStart.toISOString() : null, clean.expiresAt ? clean.expiresAt.toISOString() : null]);
        await event(tx, row.id, actor, "DATES_CHANGE", `${iso(row.starts_at) ?? "-"} | ${iso(row.expires_at) ?? "-"}`, `${nextStart ? nextStart.toISOString() : "-"} | ${clean.expiresAt ? clean.expiresAt.toISOString() : "-"}`);
        return { ok: true, startsAt: nextStart ? nextStart.toISOString() : null, expiresAt: clean.expiresAt ? clean.expiresAt.toISOString() : null };
      });
    },

    /** Historique d'une annonce : le propriétaire voit les siennes, le Superadmin toutes. */
    async history(userId, id, { staff = false } = {}) {
      if (staff) await accounts.requireStaff(userId, "SUPERADMIN");
      else {
        const own = await db.query("select 1 from ika_listings where id = $1 and owner_id = $2", [String(id).slice(0, 80), userId]);
        if (!own[0]) throw notFound("Annonce introuvable.");
      }
      const rows = await db.query(
        "select id, actor_id, actor_kind, action, old_value, new_value, created_at from ika_listing_events where listing_id = $1 order by created_at desc, id desc limit 200",
        [String(id).slice(0, 80)],
      );
      return rows.map((r) => ({ id: r.id, actorKind: r.actor_kind, automatic: r.actor_kind === "SYSTEM", actorId: staff ? r.actor_id : null, action: r.action, oldValue: r.old_value, newValue: r.new_value, createdAt: iso(r.created_at) }));
    },

    /** Supervision Superadmin : indicateurs, filtres et liste. Période = date de fin de publication. */
    async dashboard(staffId, filters = {}) {
      await accounts.requireStaff(staffId, "SUPERADMIN");
      const cfg = await getSettings();
      const window = Math.max(0, ...cfg.warningDays) || 7;
      const params = [window];
      const where = filterSql(filters, params);
      // $1 (fenêtre « expire bientôt ») est référencé dans chaque requête : PostgreSQL refuse un paramètre fourni mais inutilisé.
      const base = ` and $1::int > 0${where.length ? ` and ${where.join(" and ")}` : ""}`;
      const stats = (await db.query(
        `select
           count(*) filter (where l.status = 'PUBLISHED' and l.expires_at > now() and l.expires_at <= now() + ($1::int * interval '1 day'))::int as expiring_soon,
           count(*) filter (where l.status = 'EXPIRED' or (l.status = 'PUBLISHED' and l.expires_at <= now()))::int as expired,
           count(*) filter (where l.status = 'SOLD')::int as sold,
           count(*) filter (where l.status = 'RENTED')::int as rented,
           count(*) filter (where l.status = 'ARCHIVED' and l.archived_mode is distinct from 'AUTO')::int as archived_manual,
           count(*) filter (where l.status = 'ARCHIVED' and l.archived_mode = 'AUTO')::int as archived_auto
         from ika_listings l where true${base}`,
        params,
      ))[0];
      const extensions = (await db.query(
        `select count(*)::int as n from ika_listing_events e join ika_listings l on l.id = e.listing_id
         where e.action = 'EXTEND'${base}`,
        params,
      ))[0]?.n ?? 0;
      let list = `l.status in ('PUBLISHED', 'EXPIRED', 'SCHEDULED', 'ARCHIVED', 'SOLD', 'RENTED')`;
      if (filters.expired) list = `(l.status = 'EXPIRED' or (l.status = 'PUBLISHED' and l.expires_at <= now()))`;
      if (filters.expiring) list = `(l.status = 'PUBLISHED' and l.expires_at > now() and l.expires_at <= now() + ($1::int * interval '1 day'))`;
      const rows = await db.query(
        `select l.id, l.title, l.category, l.transaction_type, l.status, l.archived_mode, l.starts_at, l.expires_at, l.expired_at, l.archived_at, l.owner_id, l.owner_name
         from ika_listings l where ${list}${base} order by l.expires_at asc nulls last limit 100`,
        params,
      );
      const nowMs = now();
      return {
        settings: cfg,
        stats: { expiringSoon: stats.expiring_soon, expired: stats.expired, sold: stats.sold, rented: stats.rented, archivedManual: stats.archived_manual, archivedAuto: stats.archived_auto, extensions },
        items: rows.map((r) => ({
          id: r.id, title: r.title, category: r.category, transactionType: r.transaction_type, ownerId: r.owner_id, ownerName: r.owner_name,
          status: displayStatus(r, nowMs, cfg), startsAt: iso(r.starts_at), expiresAt: iso(r.expires_at), expiredAt: iso(r.expired_at), archivedAt: iso(r.archived_at),
        })),
      };
    },
  };
}
