// « Découvrir » : publications de la communauté (actualité, information, demande « Je cherche »), séparées des annonces professionnelles.
// Réglages (ouvert, photos, plafond par jour, numéro confirmé) = conditions officielles du superadmin ; modération = masquer / rétablir, tracée.
import { randomUUID } from "node:crypto";
import { badRequest, forbidden, notFound, tooMany } from "../lib/errors.js";
import { CATEGORIES, KINDS, REPORT_REASONS, TEXT_MAX, TEXT_MIN, containsPhone } from "../lib/discover.js";
import { storeDataUrl } from "../lib/file-storage.js";

const iso = (d) => (d ? new Date(d).toISOString() : null);
const PAGE = 20;

export function createDiscover({ db, accounts, rules, engagement, moderationAudit }) {
  async function settings() {
    const r = await rules.official();
    return { enabled: r.discoverEnabled, maxPhotos: r.discoverMaxPhotos, postsPerDay: r.discoverPostsPerDay, requirePhone: r.discoverRequirePhone };
  }

  const view = (r, viewerId) => ({
    id: r.id, kind: r.kind, kindLabel: KINDS[r.kind] ?? r.kind, content: r.content, category: r.category || null, zone: r.zone || null,
    photos: r.photos ?? [], createdAt: iso(r.created_at), mine: Boolean(viewerId) && r.user_id === viewerId, hidden: r.status === "HIDDEN",
    author: { id: r.user_id, name: r.name || "Utilisateur", advertiser: Boolean(r.advertiser), avatarUrl: r.avatar_url && !r.images_hidden ? r.avatar_url : null },
  });
  const PHOTOS = "(select coalesce(array_agg(ph.url order by ph.position), '{}') from ika_publication_photos ph where ph.publication_id = pb.id) as photos";
  const AUTHOR = `coalesce(nullif(pr.full_name, ''), u.name) as name, ap.avatar_url, ap.images_hidden, (ap.user_id is not null) as advertiser`;
  const AUTHOR_JOINS = `join ika_users u on u.id = pb.user_id and u.deleted_at is null join ika_profiles pr on pr.user_id = pb.user_id and pr.account_status <> 'BANNED'
                        left join ika_advertiser_profiles ap on ap.user_id = pb.user_id`;

  return {
    settings,

    /** Fil public, du plus récent au plus ancien. Les publications masquées, les comptes bloqués et les personnes que vous avez bloquées (ou qui vous ont bloqué) n'y figurent pas. */
    async feed(viewerId, { kind, category, before } = {}) {
      const s = await settings();
      if (!s.enabled) return { items: [], next: null, settings: s };
      const k = KINDS[kind] ? kind : null;
      const c = CATEGORIES.includes(category) ? category : null;
      const b = before && Number.isFinite(Date.parse(before)) ? new Date(before).toISOString() : null;
      const rows = await db.query(
        `select pb.id, pb.user_id, pb.content, pb.kind, pb.category, pb.zone, pb.status, pb.created_at, ${AUTHOR}, ${PHOTOS}
           from ika_publications pb ${AUTHOR_JOINS}
          where pb.status = 'PUBLISHED'
            and ($2::text is null or pb.kind = $2) and ($3::text is null or pb.category = $3) and ($4::timestamptz is null or pb.created_at < $4)
            and ($1::text is null or not exists (select 1 from ika_user_blocks b where (b.blocker_id = $1 and b.blocked_id = pb.user_id) or (b.blocker_id = pb.user_id and b.blocked_id = $1)))
          order by pb.created_at desc limit ${PAGE + 1}`,
        [viewerId ?? null, k, c, b]);
      const page = rows.slice(0, PAGE);
      return { items: page.map((r) => view(r, viewerId)), next: rows.length > PAGE ? iso(page[page.length - 1].created_at) : null, settings: s };
    },

    /** Publie. Texte obligatoire (pas de numéro de téléphone), photos facultatives (envoyées déjà réduites par le navigateur). */
    async create(userId, { content, kind, category, zone, photos } = {}) {
      const profile = await accounts.ensureProfile(userId);
      accounts.assertCanPublish(profile);
      const s = await settings();
      if (!s.enabled) throw forbidden("Découvrir est fermé pour le moment.");
      if (s.requirePhone) await accounts.requireVerifiedPhone(userId);
      const text = String(content ?? "").trim().slice(0, TEXT_MAX);
      if (text.length < TEXT_MIN) throw badRequest("Le texte de la publication est trop court.");
      if (containsPhone(text)) throw badRequest("Pas de numéro de téléphone dans une publication : les personnes intéressées vous écrivent par la messagerie du site. Écrivez les prix avec des espaces (25 000 000).");
      const k = kind === undefined || kind === null || kind === "" ? "ACTUALITE" : kind;
      if (!KINDS[k]) throw badRequest("Type de publication inconnu.");
      const cat = category ? String(category) : null;
      if (cat && !CATEGORIES.includes(cat)) throw badRequest("Type de bien inconnu.");
      const place = String(zone ?? "").trim().slice(0, 80) || null;
      const files = Array.isArray(photos) ? photos : [];
      if (files.length > s.maxPhotos) throw badRequest(s.maxPhotos ? `${s.maxPhotos} photo${s.maxPhotos > 1 ? "s" : ""} au maximum par publication.` : "Les photos ne sont pas autorisées pour le moment.");
      const today = Number((await db.query("select count(*)::int as n from ika_publications where user_id = $1 and created_at > now() - interval '24 hours'", [userId]))[0]?.n ?? 0);
      if (today >= s.postsPerDay) throw tooMany(`Limite atteinte : ${s.postsPerDay} publication${s.postsPerDay > 1 ? "s" : ""} par 24 heures.`);
      const urls = [];
      for (const f of files) {
        try { urls.push(`/api/media/${(await storeDataUrl(db, f, { imagesOnly: true })).id}`); }
        catch (error) { throw badRequest(error?.message || "Photo refusée."); }
      }
      const id = `pub_${randomUUID()}`;
      await db.transaction(async (tx) => {
        await tx.query("insert into ika_publications (id, user_id, content, kind, category, zone) values ($1, $2, $3, $4, $5, $6)", [id, userId, text, k, cat, place]);
        for (const [i, url] of urls.entries()) await tx.query("insert into ika_publication_photos (publication_id, position, url) values ($1, $2, $3)", [id, i, url]);
      });
      return { id };
    },

    /** Écrit à l'auteur d'une publication : ouvre (ou reprend) une conversation dans la messagerie. */
    async contact(userId, publicationId, body) {
      const s = await settings();
      if (!s.enabled) throw forbidden("Découvrir est fermé pour le moment.");
      return engagement.sendToPublication(userId, publicationId, body);
    },

    async report(userId, publicationId, reason) {
      await accounts.requireActive(userId);
      const why = String(reason ?? "").trim();
      if (!REPORT_REASONS.includes(why)) throw badRequest("Choisissez un motif de signalement.");
      const pub = (await db.query("select id, user_id from ika_publications where id = $1 and status = 'PUBLISHED'", [String(publicationId ?? "").slice(0, 80)]))[0];
      if (!pub) throw notFound("Publication introuvable.");
      if (pub.user_id === userId) throw badRequest("C'est votre propre publication.");
      await db.query("insert into ika_publication_reports (id, publication_id, reporter_id, reason) values ($1, $2, $3, $4) on conflict (publication_id, reporter_id) do nothing", [`pr_${randomUUID()}`, pub.id, userId, why]);
      return { ok: true };
    },

    // ---------- Modération (équipe) ----------
    /** Publications signalées ou masquées, les plus signalées d'abord. */
    async reported(actorId) {
      await accounts.requireStaff(actorId, "MODERATOR");
      const rows = await db.query(
        `select pb.id, pb.user_id, pb.content, pb.kind, pb.category, pb.zone, pb.status, pb.created_at, pb.hidden_at, pb.hidden_reason, hp.full_name as hidden_by_name,
                ${AUTHOR}, ${PHOTOS},
                (select count(*)::int from ika_publication_reports r where r.publication_id = pb.id) as reports,
                (select coalesce(json_agg(json_build_object('reason', r.reason, 'at', r.created_at) order by r.created_at desc), '[]'::json) from ika_publication_reports r where r.publication_id = pb.id) as report_list
           from ika_publications pb ${AUTHOR_JOINS} left join ika_profiles hp on hp.user_id = pb.hidden_by
          where pb.status = 'HIDDEN' or exists (select 1 from ika_publication_reports r where r.publication_id = pb.id)
          order by (pb.status = 'PUBLISHED') desc, (select count(*) from ika_publication_reports r where r.publication_id = pb.id) desc, pb.created_at desc limit 100`);
      return rows.map((r) => ({ ...view(r, null), reports: r.reports, reportList: r.report_list, hiddenAt: iso(r.hidden_at), hiddenReason: r.hidden_reason, hiddenByName: r.hidden_by_name || null }));
    },

    async hide(actorId, publicationId, reason) {
      await accounts.requireStaff(actorId, "MODERATOR");
      const why = String(reason ?? "").trim().slice(0, 300);
      if (why.length < 3) throw badRequest("Indiquez le motif du masquage (3 caractères au moins) : il est conservé dans l'historique.");
      const rows = await db.query("update ika_publications set status = 'HIDDEN', hidden_by = $2, hidden_at = now(), hidden_reason = $3 where id = $1 and status = 'PUBLISHED' returning user_id", [String(publicationId ?? "").slice(0, 80), actorId, why]);
      if (!rows[0]) throw notFound("Publication introuvable ou déjà masquée.");
      await moderationAudit?.log(actorId, { action: "PUBLICATION_HIDE", targetType: "publication", targetId: publicationId, details: { userId: rows[0].user_id, reason: why } }).catch(() => {});
      return { ok: true };
    },

    async restore(actorId, publicationId) {
      await accounts.requireStaff(actorId, "MODERATOR");
      const rows = await db.query("update ika_publications set status = 'PUBLISHED', hidden_by = null, hidden_at = null, hidden_reason = null where id = $1 and status = 'HIDDEN' returning user_id", [String(publicationId ?? "").slice(0, 80)]);
      if (!rows[0]) throw notFound("Publication introuvable ou déjà visible.");
      await moderationAudit?.log(actorId, { action: "PUBLICATION_RESTORE", targetType: "publication", targetId: publicationId, details: { userId: rows[0].user_id } }).catch(() => {});
      return { ok: true };
    },
  };
}
