/**
 * Profil public d'un annonceur et avis.
 * Le profil ne montre JAMAIS l'e-mail ni le téléphone. Le « statut de confiance » est une liste de critères
 * objectifs et vérifiables (jamais un jugement) : il ne garantit rien et le dit.
 */
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { newId } from "../lib/security.js";

export const REVIEW_REASONS = ["Insulte ou propos haineux", "Avis faux ou sans échange réel", "Information privée (numéro, adresse)", "Autre"];
const LIVE = "l.status = 'PUBLISHED' and l.visibility <> 'HIDDEN' and (l.expires_at is null or l.expires_at > now())";
const MIN_REVIEWS_FOR_SIGNAL = 3;
const MIN_DAYS = 30;
const PAGE = 10;

/** « Aminata Diallo » -> « Aminata D. » : le nom complet d'un auteur d'avis n'est pas affiché. */
export function shortName(name) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Utilisateur";
  const [first, second] = parts;
  return second ? `${first} ${second[0].toUpperCase()}.` : first;
}

/** Niveau de confiance à partir de critères objectifs. Fonction pure, testée. */
export function trustSummary({ phoneBySms, days, publishedNow, titleChecked, agencyVerified, reviewCount, average }) {
  const reliable = reviewCount >= MIN_REVIEWS_FOR_SIGNAL;
  const criteria = [
    { key: "sms", label: "Numéro de téléphone vérifié par SMS", ok: Boolean(phoneBySms) },
    { key: "seniority", label: `Sur Ika So depuis au moins ${MIN_DAYS} jours`, ok: days >= MIN_DAYS },
    { key: "listing", label: "Au moins une annonce en ligne", ok: publishedNow > 0 },
    { key: "proof", label: agencyVerified ? "Agence vérifiée par l'équipe (registre de commerce)" : "Au moins une annonce avec titre foncier contrôlé par l'équipe", ok: agencyVerified || titleChecked > 0 },
    { key: "reviews", label: `Au moins ${MIN_REVIEWS_FOR_SIGNAL} avis, moyenne de 4/5 ou plus`, ok: reliable && average >= 4 },
  ];
  const met = criteria.filter((c) => c.ok).length;
  const negative = reliable && average < 3;
  const level = negative ? "CAUTION" : met >= 4 ? "ESTABLISHED" : met >= 2 ? "BUILDING" : "NEW";
  const label = { CAUTION: "Avis plutôt négatifs : redoublez de prudence", ESTABLISHED: "Profil bien établi", BUILDING: "Profil en construction", NEW: "Nouveau profil" }[level];
  return { level, label, met, total: criteria.length, criteria, notice: "Ces critères sont constatés par Ika So. Ils ne sont pas une garantie : visitez le bien et faites contrôler les documents avant tout paiement." };
}

/**
 * Un abonné vu par l'annonceur. Un abonnement anonyme n'expose AUCUN identifiant ni nom ni photo : seulement la date.
 * Fonction pure, testée.
 */
export function followerView(r) {
  const since = r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at);
  if (r.anonymous) return { anonymous: true, name: "Abonné anonyme", since };
  return { anonymous: false, id: r.id, name: r.name || "Utilisateur", role: r.display_role || null, city: r.city || null, avatarUrl: r.avatar_url && !r.images_hidden ? r.avatar_url : null, since };
}

export function createReviews(ctx, accounts, profiles = null, notify = null) {
  const { db } = ctx;
  const clean = (v) => String(v ?? "").slice(0, 80);

  async function advertiser(id) {
    const rows = await db.query(
      `select u.id, u.name, u.created_at as user_created, p.full_name, p.display_role, p.account_status, p.phone_verified_at, p.phone_channel,
              p.agency_verified_at, p.agency_name, p.created_at as profile_created
       from ika_users u join ika_profiles p on p.user_id = u.id
       where u.id = $1 and u.deleted_at is null and p.account_status <> 'BANNED'`,
      [clean(id)],
    );
    if (!rows[0]) throw notFound("Profil introuvable.");
    return rows[0];
  }

  const person = (r) => ({ id: r.other_id, name: r.name || "Utilisateur", role: r.display_role || null, avatarUrl: r.avatar_url && !r.images_hidden ? r.avatar_url : null });
  const iso = (d) => (d instanceof Date ? d.toISOString() : d ? String(d) : null);
  const tell = (userId, note) => (notify ? Promise.resolve(notify(userId, note)).catch(() => undefined) : undefined);
  /** Équipe d'un compte : les comptes liés (invitation acceptée), dans les deux sens. */
  async function teamMembers(userId) {
    const rows = await db.query(
      `select l.id as link_id, l.role, l.responded_at, o.id as other_id, coalesce(nullif(p.full_name, ''), o.name) as name, p.display_role, ap.avatar_url, ap.images_hidden
       from ika_team_links l
       join ika_users o on o.id = case when l.requester_id = $1 then l.target_id else l.requester_id end and o.deleted_at is null
       left join ika_profiles p on p.user_id = o.id
       left join ika_advertiser_profiles ap on ap.user_id = o.id
       where l.status = 'ACCEPTED' and (l.requester_id = $1 or l.target_id = $1) order by l.responded_at`,
      [userId],
    );
    return rows.map((r) => ({ linkId: r.link_id, ...person(r), teamRole: r.role || null, since: iso(r.responded_at) }));
  }

  const reviewView = (r) => ({ id: r.id, rating: r.rating, body: r.body, reply: r.reply_body ? { body: r.reply_body, at: r.reply_at instanceof Date ? r.reply_at.toISOString() : String(r.reply_at) } : null, author: shortName(r.author_name), createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at) });
  const ORDER = { best: "r.rating desc, r.created_at desc", worst: "r.rating asc, r.created_at desc", recent: "r.created_at desc" };
  const FILTER = { best: "and r.rating >= 4", worst: "and r.rating <= 2", recent: "" };

  async function list(advertiserId, kind, { limit = PAGE, offset = 0 } = {}) {
    const k = ORDER[kind] ? kind : "recent";
    const rows = await db.query(
      `select r.id, r.rating, r.body, r.reply_body, r.reply_at, r.created_at, coalesce(nullif(p.full_name, ''), u.name) as author_name
       from ika_reviews r join ika_users u on u.id = r.reviewer_id left join ika_profiles p on p.user_id = r.reviewer_id
       where r.advertiser_id = $1 and r.status = 'VISIBLE' ${FILTER[k]} order by ${ORDER[k]} limit $2 offset $3`,
      [advertiserId, Math.min(Math.max(Number(limit) || PAGE, 1), 30), Math.max(Number(offset) || 0, 0)],
    );
    return rows.map(reviewView);
  }

  /** Une personne peut donner un avis seulement après un vrai échange : un message ou un contact (appel/WhatsApp) avec cet annonceur. */
  async function hasInteraction(userId, advertiserId) {
    const a = await db.query("select 1 from ika_threads where visitor_id = $1 and owner_id = $2 limit 1", [userId, advertiserId]);
    if (a[0]) return true;
    const b = await db.query(
      "select 1 from ika_contact_events e join ika_listings l on l.id = e.listing_id where e.user_id = $1 and l.owner_id = $2 limit 1", [userId, advertiserId]);
    return Boolean(b[0]);
  }

  return {
    async publicProfile(advertiserId, viewerId = null) {
      const a = await advertiser(advertiserId);
      const [stats, dist, experience, listings] = await Promise.all([
        db.query("select count(*)::int as n, coalesce(avg(rating), 0)::float as avg from ika_reviews where advertiser_id = $1 and status = 'VISIBLE'", [a.id]),
        db.query("select rating, count(*)::int as n from ika_reviews where advertiser_id = $1 and status = 'VISIBLE' group by rating", [a.id]),
        db.query(
          `select count(*) filter (where l.published_at is not null)::int as ever,
                  count(*) filter (where ${LIVE})::int as now,
                  count(*) filter (where l.status in ('SOLD', 'RENTED'))::int as closed,
                  count(*) filter (where ${LIVE} and l.document_verified_at is not null)::int as title_checked
           from ika_listings l where l.owner_id = $1`, [a.id]),
        db.query(
          `select l.id, l.title, l.category, l.transaction_type, l.price, l.neighborhood, l.city, l.surface_label, l.image_url, l.document_verified_at, l.featured_until
           from ika_listings l where l.owner_id = $1 and ${LIVE} order by l.published_at desc nulls last limit 24`, [a.id]),
      ]);
      const contacts = await db.query("select count(*)::int as n from ika_contact_events e join ika_listings l on l.id = e.listing_id where l.owner_id = $1", [a.id]);
      const days = Math.max(0, Math.floor((Date.now() - new Date(a.profile_created).getTime()) / 86_400_000));
      const count = stats[0].n;
      const average = count ? Math.round(stats[0].avg * 10) / 10 : 0;
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const d of dist) distribution[d.rating] = d.n;
      const ex = experience[0];
      const agencyVerified = Boolean(a.agency_verified_at);
      const trust = trustSummary({ phoneBySms: a.phone_verified_at && a.phone_channel === "SMS", days, publishedNow: ex.now, titleChecked: ex.title_checked, agencyVerified, reviewCount: count, average });
      let viewer = { signedIn: Boolean(viewerId), canReview: false, reason: "Connectez-vous pour donner votre avis.", mine: null };
      if (viewerId) {
        const mine = (await db.query("select id, rating, body, status from ika_reviews where advertiser_id = $1 and reviewer_id = $2", [a.id, viewerId]))[0] ?? null;
        if (viewerId === a.id) viewer = { signedIn: true, canReview: false, reason: "C'est votre propre profil.", mine: null, self: true };
        else if (!(await hasInteraction(viewerId, a.id)) && !mine) viewer = { signedIn: true, canReview: false, reason: "Vous pourrez donner votre avis après avoir contacté cet annonceur (message, appel ou WhatsApp depuis une de ses annonces).", mine: null };
        else viewer = { signedIn: true, canReview: true, reason: "", mine: mine ? { rating: mine.rating, body: mine.body, hidden: mine.status === "HIDDEN" } : null };
      }
      const [profile, history] = profiles
        ? await Promise.all([profiles.publicBlock(a.id, { agencyVerified, signedIn: Boolean(viewerId) }), profiles.history(a.id)])
        : [null, null];
      const [followers, following, isFollowing, publications, team, services, response] = await Promise.all([
        db.query("select count(*)::int as n from ika_follows where followee_id = $1", [a.id]),
        db.query("select count(*)::int as n from ika_follows where follower_id = $1", [a.id]),
        viewerId ? db.query("select anonymous from ika_follows where follower_id = $1 and followee_id = $2", [viewerId, a.id]) : Promise.resolve([]),
        db.query("select id, content, image_url, created_at from ika_publications where user_id = $1 order by created_at desc limit 10", [a.id]),
        db.query("select id, name, role from ika_team_members where user_id = $1 order by created_at", [a.id]),
        db.query("select id, title, description from ika_services where user_id = $1 order by created_at", [a.id]),
        db.query(
          `select
             count(*)::int as total,
             count(*) filter (where exists (select 1 from ika_messages m where m.thread_id = t.id and m.sender_id = $1 limit 1))::int as replied
           from ika_threads t where t.owner_id = $1`,
          [a.id]
        ),
      ]);
      const linkedTeam = await teamMembers(a.id);
      let teamLink = { status: "NONE" };
      if (viewerId && viewerId !== a.id) {
        const l = (await db.query(
          "select id, status, requester_id from ika_team_links where status in ('PENDING', 'ACCEPTED') and least(requester_id, target_id) = least($1::text, $2::text) and greatest(requester_id, target_id) = greatest($1::text, $2::text)",
          [viewerId, a.id]))[0];
        if (l) teamLink = { id: l.id, status: l.status === "ACCEPTED" ? "MEMBER" : l.requester_id === viewerId ? "SENT" : "RECEIVED" };
      }
      const resp = response[0];
      const responseRate = resp.total > 0 ? Math.round((resp.replied / resp.total) * 100) : null;
      return {
        profile, history,
        id: a.id,
        name: a.agency_verified_at && a.agency_name ? a.agency_name : (a.full_name || a.name),
        displayRole: a.display_role,
        restricted: a.account_status === "RESTRICTED",
        memberSince: new Date(a.profile_created).toISOString(),
        memberDays: days,
        agencyVerified, agencyName: agencyVerified ? a.agency_name : null,
        phoneVerifiedBySms: Boolean(a.phone_verified_at && a.phone_channel === "SMS"),
        experience: { listingsEver: ex.ever, listingsNow: ex.now, closed: ex.closed, titleChecked: ex.title_checked, contactsReceived: contacts[0].n },
        rating: { average, count, distribution },
        trust,
        listings: listings.map((r) => ({ id: r.id, title: r.title, category: r.category, transactionType: r.transaction_type, price: Number(r.price), neighborhood: r.neighborhood, city: r.city, surfaceLabel: r.surface_label, imageUrl: r.image_url, documentVerified: Boolean(r.document_verified_at) })),
        best: await list(a.id, "best", { limit: 3 }),
        worst: await list(a.id, "worst", { limit: 3 }),
        viewer,
        followers: followers[0].n,
        following: following[0].n,
        isFollowing: isFollowing.length > 0,
        followAnonymous: isFollowing[0]?.anonymous === true,
        responseRate,
        publications: publications.map((r) => ({ id: r.id, content: r.content, imageUrl: r.image_url, createdAt: r.created_at })),
        team: [...linkedTeam.map((m) => ({ id: m.linkId, userId: m.id, name: m.name, role: m.teamRole || m.role, avatarUrl: m.avatarUrl, linked: true })), ...team.map((r) => ({ id: r.id, name: r.name, role: r.role }))],
        teamLink,
        services: services.map((r) => ({ id: r.id, title: r.title, description: r.description })),
      };
    },

    /** Suivre / ne plus suivre. `anonymous` : choix fait à l'abonnement ; sinon réglage par défaut du compte. */
    async toggleFollow(userId, advertiserId, { anonymous } = {}) {
      if (userId === advertiserId) throw badRequest("Vous ne pouvez pas vous suivre vous-même.");
      await advertiser(advertiserId);
      const exists = await db.query("select 1 from ika_follows where follower_id = $1 and followee_id = $2", [userId, advertiserId]);
      if (exists.length) {
        await db.query("delete from ika_follows where follower_id = $1 and followee_id = $2", [userId, advertiserId]);
        return { following: false };
      }
      let hide = typeof anonymous === "boolean" ? anonymous : null;
      if (hide === null) hide = (await db.query("select follow_anonymous_default as d from ika_users where id = $1", [userId]))[0]?.d === true;
      await db.query("insert into ika_follows (follower_id, followee_id, anonymous) values ($1, $2, $3)", [userId, advertiserId, hide]);
      return { following: true, anonymous: hide };
    },

    /** Change la visibilité de l'identité sur un abonnement existant. */
    async setFollowAnonymity(userId, advertiserId, anonymous) {
      const rows = await db.query("update ika_follows set anonymous = $3 where follower_id = $1 and followee_id = $2 returning 1", [userId, advertiserId, anonymous === true]);
      if (!rows.length) throw notFound("Vous ne suivez pas ce compte.");
      return { following: true, anonymous: anonymous === true };
    },

    async followSettings(userId) {
      const r = await db.query("select follow_anonymous_default as d from ika_users where id = $1", [userId]);
      return { anonymousByDefault: r[0]?.d === true };
    },

    /** Réglage du compte : les prochains abonnements sont anonymes (modifiable à chaque abonnement). Option : l'appliquer aux abonnements existants. */
    async setFollowSettings(userId, { anonymousByDefault, applyToExisting = false }) {
      const on = anonymousByDefault === true;
      await db.query("update ika_users set follow_anonymous_default = $2 where id = $1", [userId, on]);
      if (applyToExisting === true) await db.query("update ika_follows set anonymous = $2 where follower_id = $1", [userId, on]);
      return { anonymousByDefault: on };
    },

    /** Les abonnés d'un profil : visibles par le propriétaire du profil uniquement. Les anonymes n'ont ni nom ni identifiant. */
    async followers(ownerId, { limit = 50, offset = 0 } = {}) {
      const rows = await db.query(
        `select f.anonymous, f.created_at, u.id, coalesce(nullif(p.full_name, ''), u.name) as name, p.display_role, ap.avatar_url, ap.images_hidden,
                (select l.city from ika_listings l where l.owner_id = u.id and l.city is not null order by l.published_at desc nulls last limit 1) as city
         from ika_follows f
         join ika_users u on u.id = f.follower_id and u.deleted_at is null
         left join ika_profiles p on p.user_id = u.id
         left join ika_advertiser_profiles ap on ap.user_id = u.id
         where f.followee_id = $1 order by f.created_at desc limit $2 offset $3`,
        [ownerId, Math.min(Math.max(Number(limit) || 50, 1), 100), Math.max(Number(offset) || 0, 0)],
      );
      const total = (await db.query("select count(*)::int as n from ika_follows where followee_id = $1", [ownerId]))[0].n;
      return { total, anonymousCount: rows.filter((r) => r.anonymous).length, items: rows.map(followerView) };
    },

    /** Les comptes que je suis, avec la visibilité de mon identité pour chacun. */
    async following(userId) {
      const rows = await db.query(
        `select f.anonymous, f.created_at, u.id, coalesce(nullif(p.full_name, ''), u.name) as name, p.display_role, ap.avatar_url, ap.images_hidden
         from ika_follows f
         join ika_users u on u.id = f.followee_id and u.deleted_at is null
         left join ika_profiles p on p.user_id = u.id
         left join ika_advertiser_profiles ap on ap.user_id = u.id
         where f.follower_id = $1 order by f.created_at desc limit 200`,
        [userId],
      );
      return rows.map((r) => ({ id: r.id, name: r.name || "Utilisateur", role: r.display_role || null, avatarUrl: r.avatar_url && !r.images_hidden ? r.avatar_url : null, anonymous: r.anonymous === true, since: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at) }));
    },

    /** Invitation d'équipe : un compte invite un autre compte. */
    async sendTeamRequest(userId, targetId, { role } = {}) {
      if (userId === targetId) throw badRequest("Vous ne pouvez pas vous inviter vous-même.");
      const target = await advertiser(targetId);
      const exists = await db.query(
        "select status from ika_team_links where status in ('PENDING', 'ACCEPTED') and least(requester_id, target_id) = least($1::text, $2::text) and greatest(requester_id, target_id) = greatest($1::text, $2::text)",
        [userId, target.id]);
      if (exists[0]) throw conflict(exists[0].status === "ACCEPTED" ? "Vous faites déjà partie de la même équipe." : "Une invitation est déjà en attente entre vos deux comptes.");
      const id = newId("tl");
      try {
        await db.query("insert into ika_team_links (id, requester_id, target_id, role) values ($1, $2, $3, $4)", [id, userId, target.id, String(role ?? "").trim().slice(0, 80) || null]);
      } catch (error) {
        if (error?.code === "23505") throw conflict("Une invitation est déjà en attente entre vos deux comptes.");
        throw error;
      }
      const me = (await db.query("select coalesce(nullif(p.full_name, ''), u.name) as name from ika_users u left join ika_profiles p on p.user_id = u.id where u.id = $1", [userId]))[0];
      await tell(target.id, { kind: "TEAM_REQUEST", title: `${me?.name ?? "Un compte"} vous invite à rejoindre son équipe`, body: "Acceptez ou refusez depuis votre profil, onglet Équipe.", link: "#/profil?tab=equipe" });
      return { id, status: "PENDING" };
    },

    /** Le compte invité accepte ou refuse. Accepté : les deux profils affichent l'autre comme membre d'équipe. */
    async respondTeamRequest(userId, linkId, accept) {
      const rows = await db.query(
        "update ika_team_links set status = $3, responded_at = now() where id = $1 and target_id = $2 and status = 'PENDING' returning requester_id",
        [String(linkId ?? "").slice(0, 80), userId, accept === true ? "ACCEPTED" : "DECLINED"]);
      if (!rows[0]) throw notFound("Invitation introuvable ou déjà traitée.");
      if (accept === true) {
        const me = (await db.query("select coalesce(nullif(p.full_name, ''), u.name) as name from ika_users u left join ika_profiles p on p.user_id = u.id where u.id = $1", [userId]))[0];
        await tell(rows[0].requester_id, { kind: "TEAM_REQUEST", title: `${me?.name ?? "Un compte"} a accepté votre invitation d'équipe`, body: "Vous êtes maintenant membres de la même équipe.", link: "#/profil?tab=equipe" });
      }
      return { status: accept === true ? "ACCEPTED" : "DECLINED" };
    },

    /** Annuler une invitation envoyée, ou quitter une équipe (l'un ou l'autre des deux comptes). */
    async removeTeamLink(userId, linkId) {
      const rows = await db.query(
        `update ika_team_links set status = case when status = 'PENDING' then 'CANCELLED' else 'REMOVED' end, responded_at = now()
         where id = $1 and (requester_id = $2 or target_id = $2) and (status = 'ACCEPTED' or (status = 'PENDING' and requester_id = $2)) returning id`,
        [String(linkId ?? "").slice(0, 80), userId]);
      if (!rows[0]) throw notFound("Relation d'équipe introuvable.");
      return { ok: true };
    },

    /** Tout ce qui concerne mon équipe : membres, invitations reçues, invitations envoyées. */
    async myTeam(userId) {
      const members = await teamMembers(userId);
      const pending = await db.query(
        `select l.id as link_id, l.role, l.created_at, l.requester_id, o.id as other_id, coalesce(nullif(p.full_name, ''), o.name) as name, p.display_role, ap.avatar_url, ap.images_hidden
         from ika_team_links l
         join ika_users o on o.id = case when l.requester_id = $1 then l.target_id else l.requester_id end and o.deleted_at is null
         left join ika_profiles p on p.user_id = o.id
         left join ika_advertiser_profiles ap on ap.user_id = o.id
         where l.status = 'PENDING' and (l.requester_id = $1 or l.target_id = $1) order by l.created_at desc`,
        [userId]);
      const row = (r) => ({ linkId: r.link_id, ...person(r), teamRole: r.role || null, since: iso(r.created_at) });
      return { members, received: pending.filter((r) => r.requester_id !== userId).map(row), sent: pending.filter((r) => r.requester_id === userId).map(row) };
    },

    async addPublication(userId, { content, imageUrl }) {
      const text = String(content ?? "").trim().slice(0, 2000);
      if (text.length < 5) throw badRequest("Le texte de la publication est trop court.");
      const id = newId("pub");
      await db.query("insert into ika_publications (id, user_id, content, image_url) values ($1, $2, $3, $4)", [id, userId, text, imageUrl || null]);
      return { id };
    },
    async deletePublication(userId, pubId) {
      const rows = await db.query("delete from ika_publications where id = $1 and user_id = $2 returning id", [pubId, userId]);
      if (!rows.length) throw notFound("Publication introuvable.");
      return { ok: true };
    },
    async addTeamMember(userId, { name, role }) {
      const n = String(name ?? "").trim().slice(0, 80);
      if (n.length < 2) throw badRequest("Nom obligatoire.");
      const id = newId("tm");
      await db.query("insert into ika_team_members (id, user_id, name, role) values ($1, $2, $3, $4)", [id, userId, n, String(role ?? "").slice(0, 80) || null]);
      return { id };
    },
    async deleteTeamMember(userId, memberId) {
      const rows = await db.query("delete from ika_team_members where id = $1 and user_id = $2 returning id", [memberId, userId]);
      if (!rows.length) throw notFound("Membre introuvable.");
      return { ok: true };
    },
    async addService(userId, { title, description }) {
      const t = String(title ?? "").trim().slice(0, 120);
      if (t.length < 2) throw badRequest("Titre obligatoire.");
      const id = newId("svc");
      await db.query("insert into ika_services (id, user_id, title, description) values ($1, $2, $3, $4)", [id, userId, t, String(description ?? "").slice(0, 500) || null]);
      return { id };
    },
    async deleteService(userId, serviceId) {
      const rows = await db.query("delete from ika_services where id = $1 and user_id = $2 returning id", [serviceId, userId]);
      if (!rows.length) throw notFound("Service introuvable.");
      return { ok: true };
    },

    async listReviews(advertiserId, kind, opts) {
      const a = await advertiser(advertiserId);
      return list(a.id, kind, opts);
    },

    async submitReview(userId, advertiserId, { rating, body }) {
      const profile = await accounts.ensureProfile(userId);
      accounts.assertCanPublish(profile);
      const a = await advertiser(advertiserId);
      if (a.id === userId) throw badRequest("Vous ne pouvez pas donner un avis sur vous-même.");
      const r = Number(rating);
      if (!Number.isInteger(r) || r < 1 || r > 5) throw badRequest("La note doit être un nombre entier de 1 à 5.");
      const text = String(body ?? "").trim().slice(0, 600);
      if (text.length < 10) throw badRequest("Décrivez votre expérience en quelques mots (10 caractères au moins).");
      if (/(\+?\d[\s.-]?){8,}/.test(text)) throw badRequest("N'écrivez pas de numéro de téléphone dans un avis.");
      const existing = (await db.query("select id, status from ika_reviews where advertiser_id = $1 and reviewer_id = $2", [a.id, userId]))[0];
      if (!existing && !(await hasInteraction(userId, a.id))) throw forbidden("Vous pourrez donner votre avis après avoir contacté cet annonceur.");
      if (existing?.status === "HIDDEN") throw conflict("Votre avis a été masqué par la modération et ne peut pas être modifié.");
      if (existing) await db.query("update ika_reviews set rating = $2, body = $3, updated_at = now() where id = $1", [existing.id, r, text]);
      else await db.query("insert into ika_reviews (id, advertiser_id, reviewer_id, rating, body) values ($1,$2,$3,$4,$5)", [newId("rv"), a.id, userId, r, text]);
      return { ok: true, updated: Boolean(existing) };
    },

    /** L'annonceur répond à un avis reçu (une réponse par avis, modifiable). Même règles de contenu que l'avis. */
    async replyToReview(userId, reviewId, body) {
      const profile = await accounts.ensureProfile(userId);
      accounts.assertCanPublish(profile);
      const text = String(body ?? "").trim().slice(0, 600);
      if (text.length < 5) throw badRequest("Votre réponse est trop courte.");
      if (/(\+?\d[\s.-]?){8,}/.test(text)) throw badRequest("N'écrivez pas de numéro de téléphone dans une réponse.");
      const rows = await db.query(
        "update ika_reviews set reply_body = $3, reply_at = now() where id = $1 and advertiser_id = $2 and status = 'VISIBLE' returning id",
        [clean(reviewId), userId, text]);
      if (!rows[0]) throw notFound("Avis introuvable.");
      return { ok: true };
    },

    async deleteMyReply(userId, reviewId) {
      await accounts.requireActive(userId);
      await db.query("update ika_reviews set reply_body = null, reply_at = null where id = $1 and advertiser_id = $2", [clean(reviewId), userId]);
      return { ok: true };
    },

    async deleteMyReview(userId, advertiserId) {
      await accounts.requireActive(userId);
      await db.query("delete from ika_reviews where advertiser_id = $1 and reviewer_id = $2", [clean(advertiserId), userId]);
      return { ok: true };
    },

    async reportReview(userId, reviewId, reason) {
      await accounts.requireActive(userId);
      if (!REVIEW_REASONS.includes(reason)) throw badRequest("Motif de signalement invalide.");
      const t = (await db.query("select id, reviewer_id from ika_reviews where id = $1 and status = 'VISIBLE'", [clean(reviewId)]))[0];
      if (!t) throw notFound("Avis introuvable.");
      if (t.reviewer_id === userId) throw badRequest("Vous ne pouvez pas signaler votre propre avis.");
      const ins = await db.query("insert into ika_review_reports (id, review_id, reporter_id, reason) values ($1,$2,$3,$4) on conflict do nothing returning id", [newId("rr"), t.id, userId, reason]);
      if (!ins[0]) throw conflict("Vous avez déjà signalé cet avis.");
      return { ok: true };
    },

    // ---------- Modération (délai visé : 48 h, voir la procédure) ----------
    async reportsOpen(staffId) {
      await accounts.requireStaff(staffId);
      const rows = await db.query(
        `select r.id as review_id, r.body, r.rating, r.advertiser_id, count(x.id)::int as reports, (array_agg(x.reason order by x.created_at desc))[1] as last_reason,
                coalesce(nullif(p.full_name, ''), u.name) as author_name
         from ika_review_reports x join ika_reviews r on r.id = x.review_id join ika_users u on u.id = r.reviewer_id left join ika_profiles p on p.user_id = r.reviewer_id
         where x.status = 'OPEN' group by r.id, p.full_name, u.name order by max(x.created_at) desc limit 100`,
      );
      return rows.map((r) => ({ reviewId: r.review_id, body: r.body, rating: r.rating, advertiserId: r.advertiser_id, authorName: r.author_name, reports: r.reports, lastReason: r.last_reason }));
    },
    async hide(staffId, reviewId) {
      await accounts.requireStaff(staffId);
      const rows = await db.query("update ika_reviews set status = 'HIDDEN', updated_at = now() where id = $1 returning id, advertiser_id", [clean(reviewId)]);
      if (!rows[0]) throw notFound("Avis introuvable.");
      await db.query("update ika_review_reports set status = 'DISMISSED' where review_id = $1", [rows[0].id]);
      await accounts.audit(staffId, "HIDE_REVIEW", null, rows[0].id);
      return { ok: true };
    },
    async dismissReports(staffId, reviewId) {
      await accounts.requireStaff(staffId);
      await db.query("update ika_review_reports set status = 'DISMISSED' where review_id = $1", [clean(reviewId)]);
      await accounts.audit(staffId, "DISMISS_REVIEW_REPORTS", null, clean(reviewId));
      return { ok: true };
    },
  };
}
