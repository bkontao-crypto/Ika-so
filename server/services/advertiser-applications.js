// Demandes pour devenir annonceur (particulier ou agence).
import { randomUUID } from "node:crypto";
import { storeDataUrl } from "../lib/file-storage.js";
import { parseProofFile } from "../lib/trust.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";

const OPEN_STATUSES = ["PENDING", "UNDER_REVIEW", "ADDITIONAL_INFO_REQUIRED"];
// Pièces jointes à une demande : toutes facultatives, pour les deux types de demande.
const DOCUMENT_LABELS = { PIECE_IDENTITE: "Pièce d'identité", RCCM: "Registre de commerce (RCCM)", AUTRE: "Autre justificatif" };
export const MAX_APPLICATION_DOCUMENTS = 5;
// Décision du propriétaire (10 nov. 2026) : pièces conservées une année après la décision, renouvelable par le titulaire.
export const DOCUMENT_RETENTION_YEARS = 1;
export const DOCUMENT_REMINDER_DAYS = 30;
const DECISIONS = {
  APPROVE: { status: "APPROVED", kind: "ADVERTISER_APPROVED", title: "Demande annonceur approuvée" },
  REJECT: { status: "REJECTED", kind: "ADVERTISER_REJECTED", title: "Demande annonceur refusée" },
  NEED_INFO: { status: "ADDITIONAL_INFO_REQUIRED", kind: "ADVERTISER_INFO", title: "Informations complémentaires demandées" },
};

export function createAdvertiserApplications({ db, accounts, notify = null }) {
  async function requireActive(userId) {
    const p = await accounts.ensureProfile(userId);
    if (p.account_status !== "ACTIVE") throw forbidden("Compte restreint.");
    return p;
  }

  return {
    async listMine(userId) {
      await requireActive(userId);
      return db.query(
        "select id, type, status, display_role_requested, admin_note, created_at, updated_at, jsonb_array_length(documents)::int as documents_count, documents_expire_at from ika_advertiser_applications where user_id = $1 order by created_at desc",
        [userId]
      );
    },

    async submit(userId, input) {
      const p = await requireActive(userId);
      const type = input.type === "AGENCE" ? "AGENCE" : "PARTICULIER";
      const existing = await db.query(
        "select id from ika_advertiser_applications where user_id = $1 and status in ('PENDING', 'UNDER_REVIEW', 'ADDITIONAL_INFO_REQUIRED') limit 1",
        [userId]
      );
      if (existing.length) throw badRequest("Vous avez déjà une demande en cours : complétez-la depuis « Devenir annonceur ».");
      const id = "app_" + randomUUID();
      const data = {
        fullName: String(input.fullName || p.full_name || "").slice(0, 120),
        phone: String(input.phone || "").slice(0, 30),
        city: String(input.city || "").slice(0, 80),
        description: String(input.description || "").slice(0, 1000),
        agencyName: type === "AGENCE" ? String(input.agencyName || "").slice(0, 120) : null,
      };
      await db.query(
        `insert into ika_advertiser_applications (id, user_id, type, status, display_role_requested, data)
         values ($1, $2, $3, 'PENDING', $4, $5)`,
        [id, userId, type, input.displayRole || (type === "AGENCE" ? "Agence immobilière" : "Propriétaire direct"), JSON.stringify(data)]
      );
      // Prévient tout le staff habilité à traiter la demande (modérateurs, administrateurs, super-administrateurs). Un échec n'annule jamais la demande.
      if (notify) {
        try {
          const staff = await db.query("select user_id from ika_profiles where staff_role in ('MODERATOR', 'ADMIN', 'SUPERADMIN') and account_status <> 'BANNED' and user_id <> $1", [userId]);
          const who = data.agencyName || data.fullName || "Un utilisateur";
          await Promise.all(staff.map((r) => notify(r.user_id, {
            kind: "ADVERTISER_APPLICATION",
            title: `Nouvelle demande annonceur : ${who}`,
            body: type === "AGENCE" ? "Demande d'agence immobilière à examiner." : "Demande de particulier à examiner.",
            link: "/admin.html",
          }).catch(() => undefined)));
        } catch { /* confort : la demande est déjà enregistrée */ }
      }
      return { id, status: "PENDING" };
    },

    /** Joint une pièce facultative à une demande encore ouverte du compte (y compris après une demande d'informations). */
    async addDocument(userId, applicationId, { label, fileData } = {}) {
      await requireActive(userId);
      let file;
      try { file = parseProofFile(fileData); } catch (error) { throw badRequest(error.message); }
      const kind = Object.hasOwn(DOCUMENT_LABELS, label) ? label : "AUTRE";
      const documentId = randomUUID();
      return db.transaction(async (tx) => {
        const rows = await tx.query(
          "select status, documents from ika_advertiser_applications where id = $1 and user_id = $2 for update",
          [String(applicationId ?? ""), userId]
        );
        if (!rows[0]) throw notFound("Demande introuvable.");
        if (!OPEN_STATUSES.includes(rows[0].status)) throw conflict("Cette demande est déjà traitée : on n'y ajoute plus de pièce.");
        const current = Array.isArray(rows[0].documents) ? rows[0].documents : [];
        if (current.length >= MAX_APPLICATION_DOCUMENTS) throw conflict(`Cinq pièces au plus par demande.`);
        const stored = await storeDataUrl(tx, fileData);
        const entry = { id: documentId, fileId: stored.id, label: kind, type: file.type, addedAt: new Date().toISOString() };
        await tx.query(
          "update ika_advertiser_applications set documents = $2::jsonb, updated_at = now() where id = $1",
          [String(applicationId), JSON.stringify([...current, entry])]
        );
        return { id: documentId, label: kind, count: current.length + 1 };
      });
    },

    /** Le titulaire prolonge d'une année la conservation de ses pièces (à partir d'aujourd'hui, jamais cumulée). */
    async renewDocuments(userId, applicationId) {
      await requireActive(userId);
      const rows = await db.query(
        `update ika_advertiser_applications set documents_expire_at = now() + interval '${DOCUMENT_RETENTION_YEARS} year', documents_expiry_notified_at = null, updated_at = now()
         where id = $1 and user_id = $2 and status in ('APPROVED', 'REJECTED') and documents <> '[]'::jsonb and documents_expire_at is not null
         returning documents_expire_at`,
        [String(applicationId ?? ""), userId]
      );
      if (!rows[0]) throw notFound("Aucune pièce conservée pour cette demande.");
      return { ok: true, expiresAt: rows[0].documents_expire_at };
    },

    /**
     * Rappel envoyé aux titulaires dont les pièces arrivent à échéance dans les 30 jours (un seul rappel par échéance).
     * Ne supprime rien : la suppression reste la commande manuelle `scripts/retention.mjs`.
     * L'UPDATE ... RETURNING marque d'abord, puis notifie : deux instances ne notifient jamais deux fois la même demande.
     */
    async notifyExpiringDocuments() {
      if (!notify) return 0;
      const rows = await db.query(
        `update ika_advertiser_applications set documents_expiry_notified_at = now()
         where status in ('APPROVED', 'REJECTED') and documents <> '[]'::jsonb
           and documents_expire_at is not null and documents_expiry_notified_at is null
           and documents_expire_at > now() and documents_expire_at <= now() + interval '${DOCUMENT_REMINDER_DAYS} days'
         returning user_id, documents_expire_at`
      );
      let sent = 0;
      for (const r of rows) {
        const day = new Date(r.documents_expire_at).toISOString().slice(0, 10).split("-").reverse().join("/");
        try {
          await notify(r.user_id, {
            kind: "ADVERTISER_DOCS_EXPIRING",
            title: `Vos pièces jointes seront supprimées le ${day}`,
            body: "Vous pouvez les conserver une année de plus depuis « Devenir annonceur ».",
            link: "#/devenir-annonceur",
          });
          sent += 1;
        } catch { /* le rappel est un confort : un échec n'annule rien */ }
      }
      return sent;
    },

    /** Lecture d'une pièce par l'équipe : seulement un fichier réellement joint à cette demande ; chaque lecture est journalisée. */
    async viewDocument(staffId, applicationId, documentId) {
      await accounts.requireStaff(staffId, "MODERATOR");
      const rows = await db.query("select user_id, documents from ika_advertiser_applications where id = $1", [String(applicationId ?? "")]);
      if (!rows[0]) throw notFound("Demande introuvable.");
      const entry = (Array.isArray(rows[0].documents) ? rows[0].documents : []).find((d) => d.id === documentId);
      if (!entry) throw notFound("Pièce introuvable.");
      const files = await db.query("select mime_type, content from stored_files where id = $1", [entry.fileId]);
      if (!files[0]) throw notFound("Pièce introuvable.");
      await accounts.audit(staffId, "VIEW_APPLICATION_DOCUMENT", null, `${applicationId}:${entry.label}`);
      return { fileType: files[0].mime_type, fileData: `data:${files[0].mime_type};base64,${Buffer.from(files[0].content).toString("base64")}` };
    },

    async listForStaff(userId, { status = "PENDING" } = {}) {
      await accounts.requireStaff(userId, "MODERATOR");
      return db.query(
        `select a.id, a.user_id, a.type, a.status, a.display_role_requested, a.data, a.admin_note, a.created_at,
                u.name as user_name, p.full_name,
                (select coalesce(jsonb_agg(jsonb_build_object('id', d->>'id', 'label', d->>'label', 'type', d->>'type')), '[]'::jsonb) from jsonb_array_elements(a.documents) d) as documents,
                (select pr.status from ika_proofs pr where pr.owner_id = a.user_id and pr.kind = 'AGENCE' order by pr.created_at desc limit 1) as agency_proof_status,
                (select pr.id from ika_proofs pr where pr.owner_id = a.user_id and pr.kind = 'AGENCE' order by pr.created_at desc limit 1) as agency_proof_id
         from ika_advertiser_applications a
         join ika_users u on u.id = a.user_id
         left join ika_profiles p on p.user_id = a.user_id
         where a.status = $1 order by a.created_at desc limit 100`,
        [status]
      );
    },

    async decide(userId, applicationId, { action, note }) {
      await accounts.requireStaff(userId, "MODERATOR");
      const rows = await db.query("select * from ika_advertiser_applications where id = $1", [applicationId]);
      if (!rows.length) throw notFound("Demande introuvable.");
      const app = rows[0];
      const decision = Object.hasOwn(DECISIONS, action) ? DECISIONS[action] : null;
      if (!decision) throw badRequest("Action inconnue.");
      if (!OPEN_STATUSES.includes(app.status)) throw conflict("Cette demande est déjà traitée.");
      const cleanNote = String(note ?? "").trim().slice(0, 500);
      if (action !== "APPROVE" && !cleanNote) throw badRequest("Un motif est obligatoire pour refuser ou demander des informations.");
      const newStatus = decision.status;
      await db.query(
        `update ika_advertiser_applications set status = $1, admin_note = $2, reviewed_by = $3, reviewed_at = now(), updated_at = now(),
           documents_expire_at = case when $1 in ('APPROVED', 'REJECTED') and documents <> '[]'::jsonb then now() + interval '${DOCUMENT_RETENTION_YEARS} year' else null end
         where id = $4`,
        [newStatus, cleanNote || null, userId, applicationId]
      );
      if (action === "APPROVE") {
        await db.query("update ika_profiles set display_role = $1 where user_id = $2", [app.display_role_requested || "Propriétaire direct", app.user_id]);
      }
      await accounts.audit(userId, "ADVERTISER_APPLICATION_" + action, null, `${app.user_id} -> ${newStatus}`);
      if (notify) {
        await notify(app.user_id, { kind: decision.kind, title: decision.title, body: cleanNote, link: action === "APPROVE" ? "#/publier" : "#/devenir-annonceur" }).catch(() => undefined);
      }
      return { ok: true, status: newStatus };
    },
  };
}
