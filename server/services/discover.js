// « Découvrir » : publications de la communauté (actualité, information, demande « Je cherche »), séparées des annonces professionnelles.
// Réglages (ouvert, photos, plafond par jour, numéro confirmé) = conditions officielles du superadmin ; modération = masquer / rétablir, tracée.
import { randomUUID } from "node:crypto";
import { badRequest, forbidden, notFound, tooMany } from "../lib/errors.js";
import { CATEGORIES, KINDS, REPORT_REASONS, TEXT_MAX, TEXT_MIN, containsPhone, parseVideoLink } from "../lib/discover.js";
import { storeDataUrl } from "../lib/file-storage.js";

const iso = (d) => (d ? new Date(d).toISOString() : null);
const PAGE = 20;

export function createDiscover({ db, accounts, rules, engagement, moderationAudit, requestsHub }) {
  async function settings() {
    const r = await rules.official();
    return { enabled: r.discoverEnabled, maxPhotos: r.discoverMaxPhotos, postsPerDay: r.discoverPostsPerDay, requirePhone: r.discoverRequirePhone, videoLinks: r.discoverVideoLinks };
  }

  /** Blocage automatique : N membres différents (signalements non classés) ont signalé ce compte. Restriction sans date de fin, levée par l'équipe. */
  async function autoBlock(authorId) {
    const limit = (await rules.official()).discoverAutoBlockReports;
    if (!limit) return false;
    const n = Number((await db.query("select count(distinct r.reporter_id)::int as n from ika_publication_reports r join ika_publications p on p.id = r.publication_id where p.user_id = $1 and r.dismissed_at is null", [authorId]))[0]?.n ?? 0);
    if (n < limit) return false;
    const reason = `Blocage automatique : ${n} membres ont signalé ce compte. En attente d'examen par l'équipe.`;
    const done = await db.query("update ika_profiles set account_status = 'RESTRICTED', status_reason = $2, status_until = null where user_id = $1 and account_status = 'ACTIVE' and staff_role = 'USER' returning user_id", [authorId, reason]);
    if (!done[0]) return false;
    await moderationAudit?.log(authorId, { action: "DISCOVER_AUTO_BLOCK", targetType: "user", targetId: authorId, details: { automatic: true, reporters: n, threshold: limit } }).catch(() => {});
    await requestsHub?.notifyStaff({ kind: "DISCOVER_AUTO_BLOCK", title: "Compte bloqué automatiquement", body: `${n} signalements de membres différents. À examiner : débloquer ou bannir.`, link: "/owner#/discover", module: "moderation" }).catch(() => {});
    return true;
  }

  const view = (r, viewerId) => ({
    id: r.id, kind: r.kind, kindLabel: KINDS[r.kind] ?? r.kind, content: r.content, category: r.category || null, zone: r.zone || null,
    photos: r.photos ?? [], video: r.video_url ? { provider: r.video_provider, url: r.video_url } : null, createdAt: iso(r.created_at), mine: Boolean(viewerId) && r.user_id === viewerId, hidden: r.status === "HIDDEN",
    author: { id: r.user_id, name: r.name || "Utilisateur", advertiser: Boolean(r.advertiser), avatarUrl: r.avatar_url && !r.images_hidden ? r.avatar_url : null },
  });
  /** Joint la carte de l'original aux republications : annonce (titre, prix, photo) ou publication (auteur, extrait). Absent si l'original a disparu. */
  async function withShared(items, rows) {
    const ids = (t) => [...new Set(rows.filter((r) => r.shared_type === t).map((r) => r.shared_id))];
    const listings = ids("LISTING").length ? await db.query("select id, title, price, neighborhood, image_url from ika_listings where id = any($1::text[]) and status = 'PUBLISHED' and visibility <> 'HIDDEN'", [ids("LISTING")]) : [];
    const pubs = ids("PUBLICATION").length ? await db.query(`select pb.id, left(pb.content, 240) as content, coalesce(nullif(pr.full_name, ''), u.name) as name, (select ph.url from ika_publication_photos ph where ph.publication_id = pb.id order by ph.position limit 1) as photo
        from ika_publications pb join ika_users u on u.id = pb.user_id join ika_profiles pr on pr.user_id = pb.user_id where pb.id = any($1::text[]) and pb.status = 'PUBLISHED'`, [ids("PUBLICATION")]) : [];
    const L = new Map(listings.map((l) => [l.id, l])), P = new Map(pubs.map((p) => [p.id, p]));
    return items.map((it, i) => {
      const r = rows[i];
      if (!r.shared_type) return it;
      const l = r.shared_type === "LISTING" ? L.get(r.shared_id) : null, p = r.shared_type === "PUBLICATION" ? P.get(r.shared_id) : null;
      const shared = l ? { type: "LISTING", id: l.id, title: l.title, price: l.price, place: l.neighborhood, photo: l.image_url, href: `#/annonce/${l.id}` }
        : p ? { type: "PUBLICATION", id: p.id, title: p.name, excerpt: p.content, photo: p.photo, href: `#/decouvrir?p=${p.id}` } : { type: r.shared_type, gone: true };
      return { ...it, shared };
    });
  }
  const PHOTOS = "(select coalesce(array_agg(ph.url order by ph.position), '{}') from ika_publication_photos ph where ph.publication_id = pb.id) as photos";
  const AUTHOR = `coalesce(nullif(pr.full_name, ''), u.name) as name, ap.avatar_url, ap.images_hidden, (ap.user_id is not null) as advertiser`;
  const AUTHOR_JOINS = `join ika_users u on u.id = pb.user_id and u.deleted_at is null join ika_profiles pr on pr.user_id = pb.user_id and pr.account_status <> 'BANNED'
                        left join ika_advertiser_profiles ap on ap.user_id = pb.user_id`;

  return {
    settings,

    /** Une publication (lien partagé #/decouvrir?p=…). */
    async get(viewerId, publicationId) {
      const rows = await db.query(
        `select pb.id, pb.user_id, pb.content, pb.kind, pb.category, pb.zone, pb.status, pb.video_url, pb.video_provider, pb.shared_type, pb.shared_id, pb.created_at, ${AUTHOR}, ${PHOTOS}
           from ika_publications pb ${AUTHOR_JOINS} where pb.id = $1 and pb.status = 'PUBLISHED'`, [String(publicationId ?? "").slice(0, 80)]);
      if (!rows[0]) throw notFound("Publication introuvable.");
      return (await withShared([view(rows[0], viewerId)], rows))[0];
    },

    /** Fil public, du plus récent au plus ancien. Les publications masquées, les comptes bloqués et les personnes que vous avez bloquées (ou qui vous ont bloqué) n'y figurent pas. */
    async feed(viewerId, { kind, category, before } = {}) {
      const s = await settings();
      if (!s.enabled) return { items: [], next: null, settings: s };
      const k = KINDS[kind] ? kind : null;
      const c = CATEGORIES.includes(category) ? category : null;
      const b = before && Number.isFinite(Date.parse(before)) ? new Date(before).toISOString() : null;
      const rows = await db.query(
        `select pb.id, pb.user_id, pb.content, pb.kind, pb.category, pb.zone, pb.status, pb.video_url, pb.video_provider, pb.shared_type, pb.shared_id, pb.created_at, ${AUTHOR}, ${PHOTOS}
           from ika_publications pb ${AUTHOR_JOINS}
          where pb.status = 'PUBLISHED'
            and ($2::text is null or pb.kind = $2) and ($3::text is null or pb.category = $3) and ($4::timestamptz is null or pb.created_at < $4)
            and ($1::text is null or not exists (select 1 from ika_user_blocks b where (b.blocker_id = $1 and b.blocked_id = pb.user_id) or (b.blocker_id = pb.user_id and b.blocked_id = $1)))
          order by pb.created_at desc limit ${PAGE + 1}`,
        [viewerId ?? null, k, c, b]);
      const page = rows.slice(0, PAGE);
      return { items: await withShared(page.map((r) => view(r, viewerId)), page), next: rows.length > PAGE ? iso(page[page.length - 1].created_at) : null, settings: s };
    },

    /** Publie. Texte obligatoire (pas de numéro de téléphone), photos facultatives (envoyées déjà réduites par le navigateur). */
    async create(userId, { content, kind, category, zone, photos, videoUrl, shared } = {}) {
      const profile = await accounts.ensureProfile(userId);
      accounts.assertCanPublish(profile);
      const s = await settings();
      if (!s.enabled) throw forbidden("Découvrir est fermé pour le moment.");
      if (s.requirePhone) await accounts.requireVerifiedPhone(userId);
      // Republication : référence vers une annonce ou une publication existante ; le commentaire est facultatif.
      let ref = null;
      if (shared?.id) {
        if (!["LISTING", "PUBLICATION"].includes(shared.type)) throw badRequest("Contenu à republier inconnu.");
        const ok = shared.type === "LISTING"
          ? await db.query("select 1 from ika_listings where id = $1 and status = 'PUBLISHED' and visibility <> 'HIDDEN'", [String(shared.id).slice(0, 80)])
          : await db.query("select 1 from ika_publications where id = $1 and status = 'PUBLISHED'", [String(shared.id).slice(0, 80)]);
        if (!ok[0]) throw notFound("Le contenu à republier n'est plus disponible.");
        ref = { type: shared.type, id: String(shared.id).slice(0, 80) };
      }
      const text = String(content ?? "").trim().slice(0, TEXT_MAX) || (ref ? "À découvrir sur Ika Sô." : "");
      if (text.length < (ref ? 1 : TEXT_MIN)) throw badRequest("Le texte de la publication est trop court.");
      if (containsPhone(text)) throw badRequest("Pas de numéro de téléphone dans une publication : les personnes intéressées vous écrivent par la messagerie du site. Écrivez les prix avec des espaces (25 000 000).");
      const k = kind === undefined || kind === null || kind === "" ? "ACTUALITE" : kind;
      if (!KINDS[k]) throw badRequest("Type de publication inconnu.");
      const cat = category ? String(category) : null;
      if (cat && !CATEGORIES.includes(cat)) throw badRequest("Type de bien inconnu.");
      const place = String(zone ?? "").trim().slice(0, 80) || null;
      const link = String(videoUrl ?? "").trim();
      let video = null;
      if (link) {
        if (!s.videoLinks) throw badRequest("Les liens vidéo ne sont pas activés pour le moment.");
        video = parseVideoLink(link);
        if (!video) throw badRequest("Collez un lien vidéo YouTube ou Facebook valide (https).");
      }
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
        await tx.query("insert into ika_publications (id, user_id, content, kind, category, zone, video_url, video_provider, shared_type, shared_id) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)", [id, userId, text, k, cat, place, video?.url ?? null, video?.provider ?? null, ref?.type ?? null, ref?.id ?? null]);
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
      const added = await db.query("insert into ika_publication_reports (id, publication_id, reporter_id, reason) values ($1, $2, $3, $4) on conflict (publication_id, reporter_id) do nothing returning id", [`pr_${randomUUID()}`, pub.id, userId, why]);
      if (added[0]) {
        // Alerte à l'équipe à chaque nouveau signalement, puis blocage automatique si le seuil fixé par le superadmin est atteint. Rien de cela ne fait échouer le signalement.
        await requestsHub?.notifyStaff({ kind: "DISCOVER_REPORT", title: "Publication Découvrir signalée", body: `Motif : ${why}. À examiner.`, link: "/owner#/discover", exceptUserId: userId, module: "moderation" }).catch(() => {});
        await autoBlock(pub.user_id).catch(() => {});
      }
      return { ok: true };
    },

    /** Le membre bloqué automatiquement (ou restreint) conteste avec ses explications et preuves : l'équipe est alertée. */
    async contest(userId, message) {
      const profile = await accounts.requireActive(userId);
      if (profile.account_status !== "RESTRICTED") throw badRequest("Votre compte n'est pas restreint.");
      const text = String(message ?? "").trim();
      if (text.length < 10) throw badRequest("Expliquez votre contestation (10 caractères au moins) : preuves, contexte.");
      await moderationAudit?.log(userId, { action: "DISCOVER_CONTEST", targetType: "user", targetId: userId, details: { message: text.slice(0, 1000) } }).catch(() => {});
      await requestsHub?.notifyStaff({ kind: "DISCOVER_CONTEST", title: "Contestation d'un compte restreint", body: text.slice(0, 200), link: "/owner#/users", exceptUserId: userId, module: "users" }).catch(() => {});
      return { ok: true };
    },

    /** Classe sans suite les signalements ouverts d'une publication (après enquête : non fondés). */
    async dismiss(actorId, publicationId) {
      await accounts.requireStaff(actorId, "MODERATOR");
      const rows = await db.query("update ika_publication_reports set dismissed_at = now(), dismissed_by = $2 where publication_id = $1 and dismissed_at is null returning id", [String(publicationId ?? "").slice(0, 80), actorId]);
      if (!rows.length) throw notFound("Aucun signalement ouvert sur cette publication.");
      await moderationAudit?.log(actorId, { action: "PUBLICATION_REPORTS_DISMISS", targetType: "publication", targetId: publicationId, details: { count: rows.length } }).catch(() => {});
      return { ok: true, dismissed: rows.length };
    },

    /** Après un déblocage : les signalements ouverts sur les publications du compte sont classés, pour repartir de zéro. */
    async dismissAccountReports(actorId, authorId) {
      const rows = await db.query("update ika_publication_reports r set dismissed_at = now(), dismissed_by = $2 from ika_publications p where p.id = r.publication_id and p.user_id = $1 and r.dismissed_at is null returning r.id", [String(authorId ?? "").slice(0, 80), actorId]);
      if (rows.length) await moderationAudit?.log(actorId, { action: "ACCOUNT_REPORTS_RESET", targetType: "user", targetId: authorId, details: { count: rows.length } }).catch(() => {});
      return rows.length;
    },

    // ---------- Modération (équipe) ----------
    /** Publications signalées ou masquées, les plus signalées d'abord. */
    async reported(actorId) {
      await accounts.requireStaff(actorId, "MODERATOR");
      const rows = await db.query(
        `select pb.id, pb.user_id, pb.content, pb.kind, pb.category, pb.zone, pb.status, pb.video_url, pb.video_provider, pb.created_at, pb.hidden_at, pb.hidden_reason, hp.full_name as hidden_by_name,
                ${AUTHOR}, ${PHOTOS},
                pr.account_status as author_status, pr.status_reason as author_status_reason,
                (select count(*)::int from ika_publication_reports r where r.publication_id = pb.id and r.dismissed_at is null) as reports,
                (select coalesce(json_agg(json_build_object('reason', r.reason, 'at', r.created_at) order by r.created_at desc), '[]'::json) from ika_publication_reports r where r.publication_id = pb.id and r.dismissed_at is null) as report_list
           from ika_publications pb ${AUTHOR_JOINS} left join ika_profiles hp on hp.user_id = pb.hidden_by
          where pb.status = 'HIDDEN' or exists (select 1 from ika_publication_reports r where r.publication_id = pb.id and r.dismissed_at is null) or pr.account_status = 'RESTRICTED'
          order by (pb.status = 'PUBLISHED') desc, (select count(*) from ika_publication_reports r where r.publication_id = pb.id and r.dismissed_at is null) desc, pb.created_at desc limit 100`);
      return rows.map((r) => ({ ...view(r, null), reports: r.reports, reportList: r.report_list, hiddenAt: iso(r.hidden_at), hiddenReason: r.hidden_reason, hiddenByName: r.hidden_by_name || null, authorStatus: r.author_status, authorStatusReason: r.author_status_reason || null }));
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
