import { badRequest, conflict, notFound } from "../lib/errors.js";
import { assertNotBlacklisted, normalizeBlacklistValue } from "../lib/blacklist.js";
import { newId } from "../lib/security.js";
import { parseProofFile, priceAnomaly } from "../lib/trust.js";
import { storeDataUrl } from "../lib/file-storage.js";

const REPORT_COMMENT_REASONS = ["Insulte ou propos haineux", "Arnaque ou demande d'acompte", "Publicité ou spam", "Autre"];
const ALERT_THRESHOLD_COMMENT_REPORTS = 3;

export function createTrust(ctx, accounts) {
  const { db } = ctx;

  async function raiseAlert(kind, { listingId = null, commentId = null, detail }) {
    await db.query(
      `insert into ika_alerts (id, kind, listing_id, comment_id, detail) values ($1, $2, $3, $4, $5)
       on conflict do nothing`,
      [newId("al"), kind, listingId, commentId, String(detail).slice(0, 300)],
    );
  }

  return {
    raiseAlert,

    // ---------- Pièces justificatives ----------
    async submitProof(userId, { kind, listingId, fileData }) {
      const profile = await accounts.requireActive(userId);
      if (!["DOCUMENT_FONCIER", "AGENCE"].includes(kind)) throw badRequest("Type de pièce inconnu.");
      let file;
      try { file = parseProofFile(fileData); } catch (error) { throw badRequest(error.message); }
      if (kind === "DOCUMENT_FONCIER") {
        const own = await db.query("select id, status from ika_listings where id = $1 and owner_id = $2", [String(listingId ?? ""), userId]);
        if (!own[0]) throw notFound("Annonce introuvable.");
        if (["ARCHIVED", "SOLD", "RENTED"].includes(own[0].status)) throw conflict("Cette annonce n'est plus active.");
      }
      const id = newId("pf");
      // Le verrou du profil sérialise les dépôts simultanés et garantit la limite de 5 pièces.
      // Le binaire et sa ligne métier sont validés dans la même transaction.
      await db.transaction(async (tx) => {
        await tx.query("select user_id from ika_profiles where user_id = $1 for update", [userId]);
        const waiting = await tx.query("select count(*)::int as n from ika_proofs where owner_id = $1 and status = 'PENDING'", [userId]);
        if (waiting[0].n >= 5) throw conflict("Vous avez déjà 5 pièces en attente de contrôle.");
        const stored = await storeDataUrl(tx, fileData);
        await tx.query(
          "insert into ika_proofs (id, owner_id, listing_id, kind, file_type, file_data, file_id) values ($1,$2,$3,$4,$5,'',$6)",
          [id, userId, kind === "DOCUMENT_FONCIER" ? listingId : null, kind, file.type, stored.id],
        );
      });
      return { id, status: "PENDING", owner: profile.full_name };
    },

    async myProofs(userId) {
      const rows = await db.query(
        `select p.id, p.kind, p.status, p.review_note, p.created_at, p.listing_id, l.title
         from ika_proofs p left join ika_listings l on l.id = p.listing_id
         where p.owner_id = $1 order by p.created_at desc limit 50`,
        [userId],
      );
      return rows.map((r) => ({ id: r.id, kind: r.kind, status: r.status, note: r.review_note, listingId: r.listing_id, listingTitle: r.title, createdAt: r.created_at }));
    },

    async proofQueue(staffId) {
      await accounts.requireStaff(staffId);
      const rows = await db.query(
        `select p.id, p.kind, p.file_type, p.created_at, p.listing_id, l.title, l.declared_document, pr.full_name
         from ika_proofs p
         join ika_profiles pr on pr.user_id = p.owner_id
         left join ika_listings l on l.id = p.listing_id
         where p.status = 'PENDING' order by p.created_at asc limit 100`,
      );
      return rows.map((r) => ({ id: r.id, kind: r.kind, fileType: r.file_type, createdAt: r.created_at, listingId: r.listing_id, listingTitle: r.title, declaredDocument: r.declared_document, ownerName: r.full_name }));
    },

    /** Ouvrir une pièce est tracé : on sait qui l'a vue et quand. */
    async viewProof(staffId, id) {
      await accounts.requireStaff(staffId);
      const rows = await db.query(
        `select p.file_type, p.file_data, p.listing_id, f.content
         from ika_proofs p left join stored_files f on f.id = p.file_id
         where p.id = $1`,
        [id],
      );
      if (!rows[0]) throw notFound("Pièce introuvable.");
      await accounts.audit(staffId, "VIEW_PROOF", rows[0].listing_id, id);
      const fileData = rows[0].content
        ? `data:${rows[0].file_type};base64,${Buffer.from(rows[0].content).toString("base64")}`
        : rows[0].file_data;
      return { fileType: rows[0].file_type, fileData };
    },

    async decideProof(staffId, id, { action, note, agencyName }) {
      await accounts.requireStaff(staffId); // les droits d'abord : un simple compte ne doit pas pouvoir sonder les pièces
      const rows = await db.query("select p.id, p.owner_id, p.listing_id, p.kind, p.status, l.declared_document from ika_proofs p left join ika_listings l on l.id = p.listing_id where p.id = $1", [String(id)]);
      const proof = rows[0];
      if (!proof) throw notFound("Pièce introuvable.");
      // Un badge d'agence engage la plateforme plus qu'un document : réservé aux administrateurs.
      await accounts.requireStaff(staffId, proof.kind === "AGENCE" ? "ADMIN" : "MODERATOR");
      if (proof.status !== "PENDING") throw conflict("Pièce déjà traitée.");
      const text = String(note ?? "").trim().slice(0, 500);
      if (action === "REFUSE") {
        if (text.length < 3) throw badRequest("Indiquez le motif du refus.");
      } else if (action === "ACCEPT") {
        if (text.length < 3) throw badRequest("Indiquez ce que vous avez contrôlé (organisme, numéro, vérification faite).");
        // Le badge ne vaut que pour un titre foncier (note juridique) : bail, lettre d'attribution, etc. n'ont pas ce badge.
        if (proof.kind === "DOCUMENT_FONCIER" && proof.declared_document !== "Titre Foncier") throw badRequest("Le badge « Titre foncier contrôlé » n'est donné que si l'annonce déclare un Titre Foncier. Refusez la pièce en expliquant pourquoi.");
        if (proof.kind === "AGENCE" && String(agencyName ?? "").trim().length < 2) throw badRequest("Indiquez le nom de l'agence.");
      } else throw badRequest("Action inconnue.");
      const updated = await db.query(
        `update ika_proofs set status = $2, reviewer_id = $3, review_note = $4, reviewed_at = now(),
           agency_name = $5 where id = $1 and status = 'PENDING' returning id`,
        [id, action === "ACCEPT" ? "ACCEPTED" : "REFUSED", staffId, text, proof.kind === "AGENCE" ? String(agencyName ?? "").trim().slice(0, 120) : null],
      );
      if (!updated[0]) throw conflict("Pièce déjà traitée.");
      if (action === "ACCEPT") {
        if (proof.kind === "DOCUMENT_FONCIER") {
          await db.query("update ika_listings set document_verified_at = now() where id = $1", [proof.listing_id]);
        } else {
          await db.query("update ika_profiles set agency_verified_at = now(), agency_name = $2 where user_id = $1", [proof.owner_id, String(agencyName).trim().slice(0, 120)]);
        }
      }
      await accounts.audit(staffId, action === "ACCEPT" ? "PROOF_ACCEPT" : "PROOF_REFUSE", proof.listing_id, `${proof.kind}: ${text}`);
      return { ok: true, ownerId: proof.owner_id, listingId: proof.listing_id };
    },

    /** Retirer un badge (pièce périmée, fraude découverte). Motif obligatoire, tracé. */
    async revokeBadge(staffId, { listingId, userId, reason }) {
      await accounts.requireStaff(staffId, "ADMIN");
      const text = String(reason ?? "").trim().slice(0, 500);
      if (text.length < 3) throw badRequest("Indiquez le motif du retrait.");
      if (listingId) await db.query("update ika_listings set document_verified_at = null where id = $1", [String(listingId)]);
      else if (userId) await db.query("update ika_profiles set agency_verified_at = null, agency_name = null where user_id = $1", [String(userId)]);
      else throw badRequest("Cible manquante.");
      await accounts.audit(staffId, "BADGE_REVOKE", listingId ?? null, `${listingId ?? userId}: ${text}`);
      return { ok: true };
    },

    // ---------- Liste noire ----------
    async blacklistList(staffId) {
      await accounts.requireStaff(staffId, "ADMIN");
      const rows = await db.query("select id, kind, value, reason, created_at from ika_blacklist order by created_at desc limit 200");
      return rows.map((r) => ({ id: r.id, kind: r.kind, value: r.value, reason: r.reason, createdAt: r.created_at }));
    },

    async blacklistAdd(staffId, { kind, value, reason }) {
      await accounts.requireStaff(staffId, "ADMIN");
      if (!["PHONE", "EMAIL"].includes(kind)) throw badRequest("Type inconnu.");
      const v = normalizeBlacklistValue(kind, value);
      const why = String(reason ?? "").trim().slice(0, 300);
      if (v.length < 6) throw badRequest("Valeur trop courte.");
      if (why.length < 3) throw badRequest("Indiquez le motif.");
      const rows = await db.query(
        "insert into ika_blacklist (id, kind, value, reason, created_by) values ($1,$2,$3,$4,$5) on conflict (kind, value) do nothing returning id",
        [newId("bl"), kind, v, why, staffId],
      );
      if (!rows[0]) throw conflict("Déjà sur la liste noire.");
      // Les comptes déjà concernés sont bloqués avec le même motif, sessions fermées.
      const col = kind === "EMAIL" ? "select id from ika_users where email = $1" : "select user_id as id from ika_profiles where phone = $1";
      for (const u of await db.query(col, [v])) {
        await db.query("update ika_profiles set account_status = 'BANNED', status_reason = $2 where user_id = $1 and staff_role = 'USER'", [u.id, `Liste noire : ${why}`]);
        await db.query("delete from ika_sessions where user_id = $1 and exists (select 1 from ika_profiles where user_id = $1 and account_status = 'BANNED')", [u.id]);
      }
      await accounts.audit(staffId, "BLACKLIST_ADD", null, `${kind} ${v.slice(0, 4)}… : ${why}`);
      return { id: rows[0].id };
    },

    async blacklistRemove(staffId, id) {
      await accounts.requireStaff(staffId, "ADMIN");
      await db.query("delete from ika_blacklist where id = $1", [String(id)]);
      await accounts.audit(staffId, "BLACKLIST_REMOVE", null, String(id));
      return { ok: true };
    },

    // ---------- Détection d'anomalies (alertes dans le centre de contrôle) ----------
    async detectListingAnomalies(listingId, { bulk = false } = {}) {
      const rows = await db.query(
        "select id, owner_id, title, category, transaction_type, neighborhood, price, surface_m2 from ika_listings where id = $1",
        [listingId],
      );
      const l = rows[0];
      if (!l) return [];
      const raised = [];
      const perM2 = Number(l.surface_m2) > 0;
      const comps = await db.query(
        `select ${perM2 ? "price::float8 / surface_m2" : "price::float8"} as v from ika_listings
         where status = 'PUBLISHED' and id <> $1 and category = $2 and transaction_type = $3 and neighborhood = $4
           ${perM2 ? "and surface_m2 > 0" : ""} limit 100`,
        [l.id, l.category, l.transaction_type, l.neighborhood],
      );
      const anomaly = priceAnomaly(perM2 ? Number(l.price) / Number(l.surface_m2) : Number(l.price), comps.map((c) => Number(c.v)));
      if (anomaly) {
        await raiseAlert("PRICE", { listingId: l.id, detail: `Prix ${anomaly.label} (${Math.round(anomaly.ratio * 100)} % de la médiane de ${comps.length} annonces comparables).` });
        raised.push("PRICE");
      }
      const burst = await db.query("select count(*)::int as n from ika_listings where owner_id = $1 and created_at > now() - interval '24 hours'", [l.owner_id]);
      if (!bulk && burst[0].n >= 5) { // un import CSV volontaire n'est pas une rafale suspecte
        await raiseAlert("BURST", { listingId: l.id, detail: `${burst[0].n} annonces déposées par le même compte en 24 h.` });
        raised.push("BURST");
      }
      return raised;
    },

    async alertsOpen(staffId) {
      await accounts.requireStaff(staffId);
      const rows = await db.query(
        `select a.id, a.kind, a.detail, a.listing_id, a.comment_id, a.created_at, l.title
         from ika_alerts a left join ika_listings l on l.id = a.listing_id
         where a.status = 'OPEN' order by a.created_at desc limit 100`,
      );
      return rows.map((r) => ({ id: r.id, kind: r.kind, detail: r.detail, listingId: r.listing_id, commentId: r.comment_id, title: r.title, createdAt: r.created_at }));
    },

    async closeAlert(staffId, id) {
      await accounts.requireStaff(staffId);
      await db.query("update ika_alerts set status = 'CLOSED', closed_by = $2 where id = $1", [String(id), staffId]);
      await accounts.audit(staffId, "ALERT_CLOSE", null, String(id));
      return { ok: true };
    },

    // ---------- Signalement des commentaires ----------
    async reportComment(userId, commentId, reason) {
      await accounts.requireActive(userId);
      if (!REPORT_COMMENT_REASONS.includes(reason)) throw badRequest("Motif de signalement invalide.");
      const target = await db.query("select id, listing_id, user_id from ika_comments where id = $1 and status = 'VISIBLE'", [String(commentId)]);
      if (!target[0]) throw notFound("Commentaire introuvable.");
      if (target[0].user_id === userId) throw badRequest("Vous ne pouvez pas signaler votre propre commentaire.");
      const ins = await db.query(
        "insert into ika_comment_reports (id, comment_id, reporter_id, reason) values ($1,$2,$3,$4) on conflict do nothing returning id",
        [newId("cr"), target[0].id, userId, reason],
      );
      if (!ins[0]) throw conflict("Vous avez déjà signalé ce commentaire.");
      const n = await db.query("select count(*)::int as n from ika_comment_reports where comment_id = $1 and status = 'OPEN'", [target[0].id]);
      if (n[0].n >= ALERT_THRESHOLD_COMMENT_REPORTS) {
        await raiseAlert("COMMENT", { listingId: target[0].listing_id, commentId: target[0].id, detail: `${n[0].n} personnes ont signalé le même commentaire.` });
      }
      return { ok: true };
    },

    async commentReportsOpen(staffId) {
      await accounts.requireStaff(staffId);
      const rows = await db.query(
        `select c.id as comment_id, c.body, c.author_name, c.listing_id, c.status, count(r.id)::int as reports,
                (array_agg(r.reason order by r.created_at desc))[1] as last_reason
         from ika_comment_reports r join ika_comments c on c.id = r.comment_id
         where r.status = 'OPEN' group by c.id order by max(r.created_at) desc limit 100`,
      );
      return rows.map((r) => ({ commentId: r.comment_id, body: r.body, authorName: r.author_name, listingId: r.listing_id, hidden: r.status === "HIDDEN", reports: r.reports, lastReason: r.last_reason }));
    },

    async dismissCommentReports(staffId, commentId) {
      await accounts.requireStaff(staffId);
      await db.query("update ika_comment_reports set status = 'DISMISSED' where comment_id = $1", [String(commentId)]);
      await accounts.audit(staffId, "DISMISS_COMMENT_REPORTS", null, String(commentId));
      return { ok: true };
    },

    assertNotBlacklisted: (kind, value) => assertNotBlacklisted(db, kind, value),
  };
}
