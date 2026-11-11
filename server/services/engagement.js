import { badRequest, conflict, forbidden, notFound, tooMany } from "../lib/errors.js";
import { cleanSearchFilters, matchesSearch } from "../lib/search.js";
import { newId } from "../lib/security.js";
import { USER_REPORT_REASONS, buildExcerpt } from "../lib/user-reports.js";
import { ALERT_MODES, DIGEST_MIN_GAP_MS, buildDigest } from "../lib/digest.js";
import { LISTING_COLUMNS, toCard } from "./cards.js";

const MAX_SEARCHES = 10;
const MAX_MESSAGES_PER_HOUR = 30;
const MAX_PENDING_VISITS = 3;
const DAY = 24 * 3600 * 1000;

export function createEngagement(ctx, accounts) {
  const { db } = ctx;
  // Canaux supplémentaires (SMS, e-mail, WhatsApp, push) : fonctions (userId, notification) branchées plus tard. Aucune par défaut.
  const channels = ctx.notifiers ?? [];

  async function notify(userId, { kind, title, body = "", link = "" }) {
    const rows = await db.query(
      `insert into ika_notifications (id, user_id, kind, title, body, link) values ($1,$2,$3,$4,$5,$6)
       on conflict do nothing returning id`,
      [newId("nt"), userId, kind, String(title).slice(0, 160), String(body).slice(0, 300), String(link).slice(0, 200)],
    );
    if (rows[0]) for (const send of channels) Promise.resolve(send(userId, { kind, title, body, link })).catch(() => undefined);
    return Boolean(rows[0]);
  }

  async function listingForThread(listingId) {
    const rows = await db.query(
      "select id, owner_id, title, status, visibility from ika_listings where id = $1",
      [String(listingId).slice(0, 80)],
    );
    const l = rows[0];
    if (!l || l.status !== "PUBLISHED" || l.visibility === "HIDDEN") throw notFound("Annonce introuvable.");
    return l;
  }

  async function threadFor(userId, threadId) {
    const rows = await db.query(
      `select t.*, l.title from ika_threads t join ika_listings l on l.id = t.listing_id
       where t.id = $1 and (t.owner_id = $2 or t.visitor_id = $2)`,
      [String(threadId).slice(0, 80), userId],
    );
    if (!rows[0]) throw notFound("Conversation introuvable.");
    return rows[0];
  }

  /** Refuse l'échange si l'une des deux personnes a bloqué l'autre. Le message ne dit pas qui bloque qui, sauf à la personne qui a bloqué. */
  async function assertNotBlocked(userId, otherId) {
    const rows = await db.query(
      "select blocker_id from ika_user_blocks where (blocker_id = $1 and blocked_id = $2) or (blocker_id = $2 and blocked_id = $1)",
      [userId, otherId],
    );
    if (!rows.length) return;
    if (rows.some((r) => r.blocker_id === userId)) throw forbidden("Vous avez bloqué cette personne. Débloquez-la pour lui écrire.");
    throw forbidden("Ce message n'a pas pu être envoyé.");
  }

  return {
    notify,

    // ---------- Recherches enregistrées et alertes ----------
    async listSearches(userId) {
      const rows = await db.query("select id, label, filters, created_at from ika_saved_searches where user_id = $1 order by created_at desc", [userId]);
      return rows.map((r) => ({ id: r.id, label: r.label, filters: r.filters, createdAt: r.created_at }));
    },

    async saveSearch(userId, { label, filters }) {
      await accounts.requireActive(userId);
      const clean = cleanSearchFilters(filters);
      if (!Object.keys(clean).length) throw badRequest("Choisissez au moins un critère avant d'enregistrer la recherche.");
      const count = await db.query("select count(*)::int as n from ika_saved_searches where user_id = $1", [userId]);
      if (count[0].n >= MAX_SEARCHES) throw conflict(`Vous avez déjà ${MAX_SEARCHES} recherches enregistrées. Supprimez-en une.`);
      const text = String(label ?? "").trim().slice(0, 80) || [clean.category, clean.transaction, clean.zone].filter(Boolean).join(" · ") || "Ma recherche";
      const id = newId("ss");
      await db.query("insert into ika_saved_searches (id, user_id, label, filters) values ($1,$2,$3,$4::jsonb)", [id, userId, text, JSON.stringify(clean)]);
      return { id, label: text };
    },

    async deleteSearch(userId, id) {
      await db.query("delete from ika_saved_searches where id = $1 and user_id = $2", [String(id), userId]);
      return { ok: true };
    },

    /** Appelé à la publication : prévient, tout de suite, les personnes dont une recherche correspond. */
    async onPublished(listingId) {
      const rows = await db.query(`select ${LISTING_COLUMNS} from ika_listings where id = $1 and status = 'PUBLISHED'`, [listingId]);
      if (!rows[0]) return { notified: 0 };
      const card = toCard(rows[0]);
      const searches = await db.query(
        `select s.user_id, s.label, s.filters from ika_saved_searches s
         join ika_profiles p on p.user_id = s.user_id and p.account_status <> 'BANNED'
         where s.user_id <> $1 limit 5000`,
        [rows[0].owner_id],
      );
      const hit = new Map();
      for (const s of searches) if (!hit.has(s.user_id) && matchesSearch(s.filters, card)) hit.set(s.user_id, s.label);
      // Les comptes qui ont choisi le résumé quotidien : l'annonce est mise en attente au lieu d'être notifiée tout de suite.
      const daily = new Set(hit.size
        ? (await db.query("select user_id from ika_alert_prefs where mode = 'DAILY' and user_id = any($1::text[])", [[...hit.keys()]])).map((r) => r.user_id)
        : []);
      let notified = 0;
      let queued = 0;
      for (const [userId, label] of hit) {
        if (daily.has(userId)) {
          const q = await db.query(
            "insert into ika_alert_pending (user_id, listing_id, label) values ($1,$2,$3) on conflict do nothing returning 1",
            [userId, card.id, String(label).slice(0, 80)],
          );
          if (q[0]) queued += 1;
        } else if (await notify(userId, { kind: "SEARCH_MATCH", title: `Nouvelle annonce : ${card.title}`, body: `Correspond à « ${label} » · ${card.neighborhood}`, link: `#/annonce/${card.id}` })) notified += 1;
      }
      return { notified, queued };
    },

    // ---------- Fréquence des alertes et résumé quotidien ----------
    async getAlertPrefs(userId) {
      const rows = await db.query("select mode from ika_alert_prefs where user_id = $1", [userId]);
      return { mode: rows[0]?.mode ?? "INSTANT" };
    },

    async setAlertPrefs(userId, mode) {
      await accounts.requireActive(userId);
      if (!ALERT_MODES.includes(mode)) throw badRequest("Fréquence inconnue.");
      await db.query(
        `insert into ika_alert_prefs (user_id, mode) values ($1,$2)
         on conflict (user_id) do update set mode = excluded.mode, updated_at = now()`,
        [userId, mode],
      );
      // Retour à l'immédiat : ce qui attendait est livré tout de suite, rien n'est perdu.
      if (mode === "INSTANT") await this.flushDigests({ userId, force: true });
      return { mode };
    },

    /**
     * Envoie les résumés dus : une notification par compte, regroupant les annonces en attente qui sont encore en ligne.
     * Sûr si plusieurs instances l'appellent ensemble (verrou) et si on le rappelle (une ligne en attente part une seule fois).
     * `userId` + `force` : livre un seul compte sans attendre le délai.
     */
    async flushDigests({ userId = null, force = false } = {}) {
      const sent = [];
      await db.transaction(async (tx) => {
        const lock = await tx.query("select pg_try_advisory_xact_lock(727002) as ok");
        if (!lock[0].ok) return;
        const due = await tx.query(
          `select distinct p.user_id from ika_alert_pending p
           left join ika_alert_prefs a on a.user_id = p.user_id
           join ika_profiles pr on pr.user_id = p.user_id and pr.account_status <> 'BANNED'
           where ($1::text is null or p.user_id = $1)
             and ($2::boolean or (a.mode = 'DAILY'
                  and (a.last_digest_at is null or a.last_digest_at <= now() - ($3::bigint * interval '1 millisecond'))))
           limit 500`,
          [userId, force, DIGEST_MIN_GAP_MS],
        );
        for (const { user_id: id } of due) {
          // Les lignes sortent de la file dans la même transaction que la notification : tout ou rien.
          const taken = await tx.query(
            `with gone as (delete from ika_alert_pending where user_id = $1 returning listing_id, label, created_at)
             select l.id, l.title, l.neighborhood, g.label from gone g
             join ika_listings l on l.id = g.listing_id
             where l.status = 'PUBLISHED' and l.visibility <> 'HIDDEN' and (l.expires_at is null or l.expires_at > now())
             order by g.created_at asc`,
            [id],
          );
          const digest = buildDigest(taken);
          if (digest) {
            await tx.query(
              "insert into ika_notifications (id, user_id, kind, title, body, link) values ($1,$2,'SEARCH_DIGEST',$3,$4,$5)",
              [newId("nt"), id, digest.title.slice(0, 160), digest.body.slice(0, 300), digest.link.slice(0, 200)],
            );
            sent.push({ userId: id, ...digest });
          }
          if (!force) await tx.query("update ika_alert_prefs set last_digest_at = now() where user_id = $1", [id]);
        }
      });
      // Canaux externes (SMS, e-mail…) : seulement après validation de la transaction.
      for (const n of sent) for (const send of channels) Promise.resolve(send(n.userId, { kind: "SEARCH_DIGEST", title: n.title, body: n.body, link: n.link })).catch(() => undefined);
      return { sent: sent.length };
    },

    // ---------- Notifications ----------
    async notifications(userId) {
      const rows = await db.query("select id, kind, title, body, link, read_at, created_at from ika_notifications where user_id = $1 order by created_at desc limit 50", [userId]);
      return rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, link: r.link, read: Boolean(r.read_at), createdAt: r.created_at }));
    },

    async unreadCounts(userId) {
      const rows = await db.query(
        `select
           (select count(*)::int from ika_notifications where user_id = $1 and read_at is null) as notifications,
           (select count(*)::int from ika_threads t where (t.owner_id = $1 and (t.owner_read_at is null or t.owner_read_at < t.last_message_at))
              or (t.visitor_id = $1 and (t.visitor_read_at is null or t.visitor_read_at < t.last_message_at))) as threads,
           (select count(*)::int from ika_visit_requests where owner_id = $1 and status = 'PENDING') as visits`,
        [userId],
      );
      return rows[0];
    },

    async markRead(userId, id) {
      if (id) await db.query("update ika_notifications set read_at = now() where id = $1 and user_id = $2 and read_at is null", [String(id), userId]);
      else await db.query("update ika_notifications set read_at = now() where user_id = $1 and read_at is null", [userId]);
      return { ok: true };
    },

    // ---------- Messagerie interne ----------
    async sendToListing(userId, listingId, body) {
      const profile = await accounts.ensureProfile(userId);
      accounts.assertCanPublish(profile);
      const text = String(body ?? "").trim().slice(0, 1000);
      if (text.length < 2) throw badRequest("Le message est trop court.");
      const l = await listingForThread(listingId);
      if (l.owner_id === userId) throw badRequest("C'est votre propre annonce.");
      return this.post(userId, null, text, l);
    },

    async reply(userId, threadId, body) {
      const profile = await accounts.ensureProfile(userId);
      accounts.assertCanPublish(profile);
      const text = String(body ?? "").trim().slice(0, 1000);
      if (text.length < 2) throw badRequest("Le message est trop court.");
      return this.post(userId, await threadFor(userId, threadId), text);
    },

    async post(userId, thread, text, listing = null) {
      await assertNotBlocked(userId, thread ? (thread.owner_id === userId ? thread.visitor_id : thread.owner_id) : listing.owner_id);
      const recent = await db.query("select count(*)::int as n from ika_messages where sender_id = $1 and created_at > now() - interval '1 hour'", [userId]);
      if (recent[0].n >= MAX_MESSAGES_PER_HOUR) throw tooMany("Trop de messages envoyés. Réessayez plus tard.");
      let t = thread;
      if (!t) {
        const rows = await db.query(
          `insert into ika_threads (id, listing_id, owner_id, visitor_id) values ($1,$2,$3,$4)
           on conflict (listing_id, visitor_id) do update set last_message_at = ika_threads.last_message_at
           returning id, owner_id, visitor_id`,
          [newId("th"), listing.id, listing.owner_id, userId],
        );
        t = { ...rows[0], title: listing.title };
      }
      await db.query("insert into ika_messages (id, thread_id, sender_id, body) values ($1,$2,$3,$4)", [newId("ms"), t.id, userId, text]);
      const mine = t.owner_id === userId ? "owner_read_at" : "visitor_read_at";
      await db.query(`update ika_threads set last_message_at = now(), ${mine} = now() where id = $1`, [t.id]);
      const other = t.owner_id === userId ? t.visitor_id : t.owner_id;
      await notify(other, { kind: "MESSAGE", title: `Nouveau message : ${t.title}`, body: text.slice(0, 120), link: `#/boite/${t.id}` });
      return { threadId: t.id };
    },

    async threads(userId) {
      const rows = await db.query(
        `select t.id, t.listing_id, t.owner_id, t.visitor_id, t.last_message_at, l.title, l.image_url,
           (t.owner_id = $1 and (t.owner_read_at is null or t.owner_read_at < t.last_message_at)) or
           (t.visitor_id = $1 and (t.visitor_read_at is null or t.visitor_read_at < t.last_message_at)) as unread,
           (select count(*)::int from ika_messages m where m.thread_id = t.id and m.sender_id <> $1
              and m.created_at > coalesce(case when t.owner_id = $1 then t.owner_read_at else t.visitor_read_at end, '-infinity'::timestamptz)) as unread_count,
           (select body from ika_messages m where m.thread_id = t.id order by m.created_at desc limit 1) as last_body,
           (select sender_id from ika_messages m where m.thread_id = t.id order by m.created_at desc limit 1) as last_sender,
           (select created_at from ika_messages m where m.thread_id = t.id order by m.created_at desc limit 1) as last_at,
           case when t.owner_id = $1 then t.visitor_read_at else t.owner_read_at end as other_read_at,
           (select coalesce(nullif(p.full_name, ''), u.name) from ika_users u left join ika_profiles p on p.user_id = u.id where u.id = case when t.owner_id = $1 then t.visitor_id else t.owner_id end) as other_name,
           exists (select 1 from ika_user_blocks b where b.blocker_id = $1 and b.blocked_id = case when t.owner_id = $1 then t.visitor_id else t.owner_id end) as blocked_by_me
         from ika_threads t join ika_listings l on l.id = t.listing_id
         where t.owner_id = $1 or t.visitor_id = $1 order by t.last_message_at desc limit 50`,
        [userId],
      );
      return rows.map((r) => ({
        id: r.id, listingId: r.listing_id, title: r.title, imageUrl: r.image_url, otherName: r.other_name,
        otherId: r.owner_id === userId ? r.visitor_id : r.owner_id, lastBody: r.last_body, lastMine: r.last_sender === userId,
        lastRead: r.last_sender === userId && r.other_read_at != null && r.last_at != null && new Date(r.other_read_at) >= new Date(r.last_at),
        unread: r.unread, unreadCount: r.unread_count, lastMessageAt: r.last_message_at, asOwner: r.owner_id === userId, blockedByMe: r.blocked_by_me,
      }));
    },

    async thread(userId, threadId) {
      const t = await threadFor(userId, threadId);
      const messages = await db.query(
        "select id, sender_id, body, created_at from ika_messages where thread_id = $1 order by created_at asc limit 200",
        [t.id],
      );
      const col = t.owner_id === userId ? "owner_read_at" : "visitor_read_at";
      await db.query(`update ika_threads set ${col} = now() where id = $1`, [t.id]);
      await db.query("update ika_notifications set read_at = now() where user_id = $1 and link = $2 and read_at is null", [userId, `#/boite/${t.id}`]);
      const other = t.owner_id === userId ? t.visitor_id : t.owner_id;
      const blocked = await db.query("select 1 from ika_user_blocks where blocker_id = $1 and blocked_id = $2", [userId, other]);
      const who = await db.query("select coalesce(nullif(p.full_name, ''), u.name) as name from ika_users u left join ika_profiles p on p.user_id = u.id where u.id = $1", [other]);
      const img = await db.query("select image_url from ika_listings where id = $1", [t.listing_id]);
      const otherReadAt = t.owner_id === userId ? t.visitor_read_at : t.owner_read_at;
      return {
        id: t.id, listingId: t.listing_id, title: t.title, imageUrl: img[0]?.image_url ?? "", blockedByMe: Boolean(blocked[0]),
        otherId: other, otherName: who[0]?.name ?? "", otherIsAdvertiser: t.owner_id === other,
        messages: messages.map((m) => ({ id: m.id, mine: m.sender_id === userId, body: m.body, createdAt: m.created_at,
          read: m.sender_id === userId && otherReadAt != null && new Date(otherReadAt) >= new Date(m.created_at) })),
      };
    },

    // ---------- Blocage et signalement d'une personne ----------
    /** Bloque l'autre personne de la conversation : plus de message ni de demande de visite dans les deux sens. */
    async blockFromThread(userId, threadId) {
      await accounts.requireActive(userId);
      const t = await threadFor(userId, threadId);
      const other = t.owner_id === userId ? t.visitor_id : t.owner_id;
      await db.query("insert into ika_user_blocks (blocker_id, blocked_id) values ($1,$2) on conflict do nothing", [userId, other]);
      return { blockedByMe: true };
    },

    async unblockFromThread(userId, threadId) {
      const t = await threadFor(userId, threadId);
      const other = t.owner_id === userId ? t.visitor_id : t.owner_id;
      await db.query("delete from ika_user_blocks where blocker_id = $1 and blocked_id = $2", [userId, other]);
      return { blockedByMe: false };
    },

    /** Signale l'autre personne de la conversation à la modération, avec les derniers messages comme seul contexte. */
    async reportFromThread(userId, threadId, { reason, details }) {
      await accounts.requireActive(userId);
      if (!USER_REPORT_REASONS.includes(reason)) throw badRequest("Motif de signalement invalide.");
      const t = await threadFor(userId, threadId);
      const other = t.owner_id === userId ? t.visitor_id : t.owner_id;
      const messages = await db.query(
        "select sender_id, body, created_at from ika_messages where thread_id = $1 order by created_at desc limit 10",
        [t.id],
      );
      const excerpt = buildExcerpt(messages.reverse(), userId);
      const rows = await db.query(
        `insert into ika_user_reports (id, reporter_id, reported_id, thread_id, reason, details, excerpt)
         values ($1,$2,$3,$4,$5,$6,$7::jsonb) on conflict do nothing returning id`,
        [newId("ur"), userId, other, t.id, reason, String(details ?? "").trim().slice(0, 1000), JSON.stringify(excerpt)],
      );
      if (!rows[0]) throw conflict("Vous avez déjà signalé cette personne. La modération examine votre signalement.");
      return { ok: true };
    },

    /** File de la modération : une ligne par personne signalée, la plus signalée d'abord. */
    async userReportsOpen(staffId) {
      await accounts.requireStaff(staffId);
      const rows = await db.query(
        `select r.reported_id, u.name, count(*)::int as reports,
                (array_agg(r.reason order by r.created_at desc))[1] as last_reason,
                (array_agg(r.details order by r.created_at desc))[1] as last_details,
                (array_agg(r.excerpt order by r.created_at desc))[1] as last_excerpt
         from ika_user_reports r join ika_users u on u.id = r.reported_id
         where r.status = 'OPEN' group by r.reported_id, u.name order by count(*) desc, max(r.created_at) desc limit 100`,
      );
      return rows.map((r) => ({ userId: r.reported_id, name: r.name, reports: r.reports, lastReason: r.last_reason, lastDetails: r.last_details ?? "", excerpt: r.last_excerpt ?? [] }));
    },

    async dismissUserReports(staffId, reportedId) {
      await accounts.requireStaff(staffId);
      await db.query("update ika_user_reports set status = 'DISMISSED' where reported_id = $1 and status = 'OPEN'", [String(reportedId).slice(0, 80)]);
      await accounts.audit(staffId, "DISMISS_USER_REPORTS", null, String(reportedId).slice(0, 80));
      return { ok: true };
    },

    // ---------- Demandes de visite ----------
    async requestVisit(userId, listingId, { proposedAt, note }) {
      const profile = await accounts.ensureProfile(userId);
      accounts.assertCanPublish(profile);
      const l = await listingForThread(listingId);
      if (l.owner_id === userId) throw badRequest("C'est votre propre annonce.");
      await assertNotBlocked(userId, l.owner_id);
      const when = new Date(proposedAt);
      if (Number.isNaN(when.getTime())) throw badRequest("Date de visite invalide.");
      if (when.getTime() < Date.now() + 3600 * 1000) throw badRequest("Proposez une date dans le futur (au moins une heure).");
      if (when.getTime() > Date.now() + 60 * DAY) throw badRequest("Proposez une date dans les 60 prochains jours.");
      const pending = await db.query("select count(*)::int as n from ika_visit_requests where requester_id = $1 and status = 'PENDING'", [userId]);
      if (pending[0].n >= MAX_PENDING_VISITS) throw conflict(`Vous avez déjà ${MAX_PENDING_VISITS} demandes de visite en attente.`);
      const same = await db.query("select 1 from ika_visit_requests where requester_id = $1 and listing_id = $2 and status = 'PENDING'", [userId, l.id]);
      if (same[0]) throw conflict("Une demande de visite est déjà en attente pour cette annonce.");
      const id = newId("vr");
      await db.query(
        "insert into ika_visit_requests (id, listing_id, requester_id, owner_id, proposed_at, note) values ($1,$2,$3,$4,$5,$6)",
        [id, l.id, userId, l.owner_id, when.toISOString(), String(note ?? "").trim().slice(0, 300)],
      );
      await notify(l.owner_id, { kind: "VISIT_REQUEST", title: `Demande de visite : ${l.title}`, body: `Proposée le ${when.toISOString().slice(0, 16).replace("T", " ")} (heure du Mali)`, link: "#/boite?onglet=visites" });
      return { id };
    },

    async visits(userId) {
      const rows = await db.query(
        `select v.id, v.listing_id, v.proposed_at, v.note, v.status, v.answer_note, v.owner_id, l.title,
                (select name from ika_users u where u.id = case when v.owner_id = $1 then v.requester_id else v.owner_id end) as other_name
         from ika_visit_requests v join ika_listings l on l.id = v.listing_id
         where v.owner_id = $1 or v.requester_id = $1 order by v.proposed_at desc limit 50`,
        [userId],
      );
      return rows.map((r) => ({ id: r.id, listingId: r.listing_id, title: r.title, proposedAt: r.proposed_at, note: r.note, status: r.status, answerNote: r.answer_note, otherName: r.other_name, asOwner: r.owner_id === userId }));
    },

    async answerVisit(userId, id, { accept, note }) {
      await accounts.requireActive(userId);
      const rows = await db.query("select v.id, v.requester_id, v.owner_id, v.status, v.proposed_at, l.title from ika_visit_requests v join ika_listings l on l.id = v.listing_id where v.id = $1", [String(id)]);
      const v = rows[0];
      if (!v) throw notFound("Demande introuvable.");
      if (v.owner_id !== userId) throw forbidden("Seul l'annonceur répond à une demande de visite.");
      if (v.status !== "PENDING") throw conflict("Demande déjà traitée.");
      const text = String(note ?? "").trim().slice(0, 300);
      if (!accept && text.length < 3) throw badRequest("Indiquez pourquoi vous refusez (ou proposez une autre date).");
      await db.query("update ika_visit_requests set status = $2, answer_note = $3, answered_at = now() where id = $1", [v.id, accept ? "ACCEPTED" : "DECLINED", text]);
      await notify(v.requester_id, { kind: "VISIT_ANSWER", title: `Visite ${accept ? "acceptée" : "refusée"} : ${v.title}`, body: text, link: "#/boite?onglet=visites" });
      return { ok: true };
    },

    async cancelVisit(userId, id) {
      const rows = await db.query("update ika_visit_requests set status = 'CANCELLED', answered_at = now() where id = $1 and requester_id = $2 and status = 'PENDING' returning id", [String(id), userId]);
      if (!rows[0]) throw notFound("Demande introuvable ou déjà traitée.");
      return { ok: true };
    },
  };
}
