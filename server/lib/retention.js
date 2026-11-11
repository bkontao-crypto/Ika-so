/**
 * Durées de conservation PAR DÉFAUT (décision prise pour le propriétaire le 03/11/2026, révisable ; à faire valider par un juriste malien).
 * Commande MANUELLE uniquement (jamais de minuterie) : simulation par défaut, suppression avec --apply --confirm=PURGER.
 * Jamais supprimés ici : factures et paiements (obligation comptable, 10 ans proposés), liste noire, journal des demandes de droits,
 * annonces vendues ou louées (elles nourrissent l'« expérience » du profil), comptes.
 */
export const RETENTION = {
  otpDays: 7,               // codes SMS : inutiles après quelques jours
  sessionGraceDays: 7,      // sessions expirées
  proofFileDays: 90,        // pièces justificatives : effacées 90 jours après la décision (le badge reste, la note de contrôle aussi)
  applicationDocumentYears: 1, // pièces jointes aux demandes annonceur : un an après la décision, renouvelable par le titulaire (échéance dans documents_expire_at)
  notificationReadDays: 180,
  notificationAnyDays: 365,
  threadMonths: 24,         // conversations sans message depuis 24 mois
  visitMonths: 24,
  closedListingMonths: 12,  // annonces refusées, expirées ou archivées depuis 12 mois (sans paiement)
  auditMonths: 36,          // journal d'actions de l'équipe
  inactiveAccountMonths: 24 // SIGNALÉ seulement : jamais supprimé automatiquement
};

export const RETENTION_CONFIRM_WORD = "PURGER";

const rules = (r = RETENTION) => [
  { key: "otp", label: `Codes SMS de plus de ${r.otpDays} jours`,
    from: "ika_otp", where: `created_at < now() - interval '${r.otpDays} days'` },
  { key: "sessions", label: `Sessions expirées depuis plus de ${r.sessionGraceDays} jours`,
    from: "ika_sessions", where: `expires_at < now() - interval '${r.sessionGraceDays} days'` },
  { key: "notifications", label: `Notifications lues depuis ${r.notificationReadDays} jours, ou de plus de ${r.notificationAnyDays} jours`,
    from: "ika_notifications", where: `(read_at is not null and read_at < now() - interval '${r.notificationReadDays} days') or created_at < now() - interval '${r.notificationAnyDays} days'` },
  { key: "threads", label: `Conversations sans message depuis ${r.threadMonths} mois (messages inclus)`,
    from: "ika_threads", where: `last_message_at < now() - interval '${r.threadMonths} months'` },
  { key: "visits", label: `Demandes de visite closes depuis ${r.visitMonths} mois`,
    from: "ika_visit_requests", where: `status <> 'PENDING' and created_at < now() - interval '${r.visitMonths} months'` },
  { key: "listings", label: `Annonces refusées, expirées ou archivées depuis ${r.closedListingMonths} mois, sans paiement`,
    from: "ika_listings l", where: `l.status in ('REJECTED','EXPIRED','ARCHIVED') and l.updated_at < now() - interval '${r.closedListingMonths} months' and not exists (select 1 from ika_payments p where p.listing_id = l.id)` },
  { key: "audit", label: `Journal d'actions de l'équipe de plus de ${r.auditMonths} mois`,
    from: "ika_audit", where: `created_at < now() - interval '${r.auditMonths} months'` },
];

const expiredApplicationDocs = `from ika_advertiser_applications where documents_expire_at < now() and documents <> '[]'::jsonb`;
const proofFiles = (r) => `from stored_files f join ika_proofs p on p.file_id = f.id where p.status <> 'PENDING' and p.reviewed_at < now() - interval '${r.proofFileDays} days'`;

/** Simulation : combien de lignes seraient concernées. Ne modifie rien. */
export async function planRetention(db, r = RETENTION) {
  const out = [];
  for (const rule of rules(r)) {
    const n = (await db.query(`select count(*)::int as n from ${rule.from} where ${rule.where}`))[0].n;
    out.push({ key: rule.key, label: rule.label, count: n });
  }
  const files = (await db.query(`select count(*)::int as n ${proofFiles(r)}`))[0].n;
  out.push({ key: "proof_files", label: `Pièces justificatives décidées depuis plus de ${r.proofFileDays} jours (fichier effacé, décision conservée)`, count: files });
  const appDocs = (await db.query(`select count(*)::int as n ${expiredApplicationDocs}`))[0].n;
  out.push({ key: "application_documents", label: "Demandes annonceur dont les pièces jointes ont dépassé leur échéance d'un an non renouvelée (fichiers effacés, décision conservée)", count: appDocs });
  const inactive = (await db.query(
    `select count(*)::int as n from ika_users u join ika_profiles p on p.user_id = u.id
     where u.deleted_at is null and p.staff_role = 'USER'
       and coalesce((select max(s.created_at) from ika_sessions s where s.user_id = u.id), u.created_at) < now() - interval '${r.inactiveAccountMonths} months'
       and not exists (select 1 from ika_listings l where l.owner_id = u.id and l.status = 'PUBLISHED')
       and not exists (select 1 from ika_payments y where y.user_id = u.id)`))[0].n;
  out.push({ key: "inactive_accounts", label: `Comptes sans connexion depuis ${r.inactiveAccountMonths} mois, sans annonce en ligne ni paiement (SIGNALÉS seulement, jamais supprimés ici)`, count: inactive, reportOnly: true });
  return out;
}

/** Suppression réelle, dans une seule transaction, avec trace dans le journal. */
export async function applyRetention(db, { actor = "cli", r = RETENTION } = {}) {
  return db.transaction(async (tx) => {
    const done = [];
    // Les fichiers des pièces d'abord (la référence passe à NULL), puis les anciennes copies d'origine.
    const files = await tx.query(`select f.id::text as id ${proofFiles(r)}`);
    for (const f of files) await tx.query("delete from stored_files where id = $1::uuid", [f.id]);
    await tx.query(`update ika_proofs set legacy_file_data = null where status <> 'PENDING' and reviewed_at < now() - interval '${r.proofFileDays} days' and legacy_file_data is not null`);
    done.push({ key: "proof_files", count: files.length });
    const appRows = await tx.query(`select id, documents ${expiredApplicationDocs}`);
    let appFiles = 0;
    for (const a of appRows) {
      for (const d of Array.isArray(a.documents) ? a.documents : []) {
        if (d?.fileId) { await tx.query("delete from stored_files where id = $1::uuid", [d.fileId]); appFiles += 1; }
      }
      await tx.query("update ika_advertiser_applications set documents = '[]'::jsonb, documents_expire_at = null, updated_at = now() where id = $1", [a.id]);
    }
    done.push({ key: "application_documents", count: appFiles });
    for (const rule of rules(r)) {
      const alias = rule.from.split(" ")[1];
      const rows = await tx.query(`with d as (delete from ${rule.from} where ${rule.where} returning 1) select count(*)::int as n from d`);
      done.push({ key: rule.key, count: rows[0].n });
      void alias;
    }
    await tx.query("insert into ika_audit (id, actor_id, action, listing_id, note) values ($1,$2,'RETENTION_PURGE',null,$3)",
      [`aud-ret-${Date.now()}`, actor, done.map((d) => `${d.key}:${d.count}`).join(" ").slice(0, 480)]);
    return done;
  });
}
