import { premiumOrigin } from "../lib/analytics-events.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { newId } from "../lib/security.js";
import { assertFeaturedCap } from "../lib/rules.js";

const MAX_PRICE_XOF = 5_000_000;

/**
 * Paiements : mise à la une d'une annonce et abonnement Premium. `provider` vient de selectProvider (null = désactivé).
 * Règle d'or : une annonce n'est mise à la une (et le Premium n'est activé) que lorsque le fournisseur confirme le paiement
 * (webhook signé) avec le bon montant. Jamais sur la simple parole du navigateur.
 */
export function createPayments(ctx, accounts, provider, onPaid = null) {
  const { db } = ctx;
  const enabled = () => Boolean(provider);

  async function featuredCap() {
    const rows = await db.query("select value from ika_settings where key = 'featured_max'");
    const n = Number(rows[0]?.value);
    return Number.isInteger(n) && n >= 0 ? n : 6;
  }

  const view = (r) => ({
    id: r.id, kind: r.kind ?? "BOOST", listingId: r.listing_id ?? null, offer: r.offer_code, days: r.days, amountXof: r.amount_xof, status: r.status,
    createdAt: r.created_at, paidAt: r.paid_at, invoice: r.invoice ?? null,
    checkoutUrl: r.status === "PENDING" ? r.checkout_url ?? null : null,
    refundedAt: r.refunded_at ?? null, refundReason: r.refund_reason ?? null, refundConfirmed: Boolean(r.refund_confirmed_at),
  });

  /**
   * Donne l'effet payé : prolonge la mise à la une, émet la facture. Rejouable sans effet double.
   * `q` doit être une transaction : le marquage « appliqué », la prolongation et la facture réussissent ensemble ou pas du tout.
   */
  async function apply(paymentId, q) {
    const claimed = await q.query(
      "update ika_payments set applied_at = now() where id = $1 and status = 'PAID' and applied_at is null returning *",
      [paymentId],
    );
    const p = claimed[0];
    if (!p) return false;
    if (p.kind === "PREMIUM") {
      // Abonnement Premium : prolonge la date d'expiration du profil (à partir d'aujourd'hui, ou de l'échéance si elle n'est pas passée) et garde la trace dans l'historique.
      const prof = await q.query(
        "update ika_profiles set premium_until = greatest(coalesce(premium_until, now()), now()) + ($2 || ' days')::interval where user_id = $1 returning user_id",
        [p.user_id, String(p.days)],
      );
      if (!prof[0]) throw notFound("Profil introuvable pour activer le Premium.");
      await q.query(
        "insert into ika_premium_grants (id, user_id, granted_by, days, reason, payment_id) values ($1, $2, null, $3, $4, $5) on conflict do nothing",
        [newId("pg"), p.user_id, p.days, `Paiement ${p.id}`, p.id],
      );
    } else {
      await q.query(
        `update ika_listings set featured_until = greatest(coalesce(featured_until, now()), now()) + ($2 || ' days')::interval, updated_at = now()
         where id = $1`,
        [p.listing_id, String(p.days)],
      );
    }
    const offer = await q.query("select label from ika_offers where code = $1", [p.offer_code]);
    await q.query(
      `insert into ika_invoices (number, payment_id, user_id, label, amount_xof, customer_name)
       values ('IKA-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('ika_invoice_seq')::text, 6, '0'), $1, $2, $3, $4,
               (select name from ika_users where id = $2))
       on conflict (payment_id) do nothing`,
      [p.id, p.user_id, offer[0]?.label ?? p.offer_code, p.amount_xof],
    );
    return true;
  }

  const applyAtomic = (paymentId) => db.transaction((tx) => apply(paymentId, tx));

  /**
   * Passe un paiement PAID en REFUNDED, une seule fois, et retire de l'annonce les jours que CE paiement avait donnés
   * (les jours d'un autre paiement valide restent). `q` : transaction ; la ligne doit être verrouillée par l'appelant.
   */
  async function refundPaid(q, p, { by, reason, refundRef = "", confirmed = false }) {
    await q.query(
      `update ika_payments set status = 'REFUNDED', refunded_at = now(), refund_reason = $2, refunded_by = $3, refund_ref = nullif($4, ''),
              refund_confirmed_at = case when $5::boolean then now() else null end
       where id = $1`,
      [p.id, String(reason).slice(0, 300), by, String(refundRef).slice(0, 120), confirmed],
    );
    if (p.applied_at && p.kind === "PREMIUM") {
      await q.query(
        `update ika_profiles set premium_until = case when premium_until - ($2 || ' days')::interval > now() then premium_until - ($2 || ' days')::interval else null end
         where user_id = $1 and premium_until is not null`,
        [p.user_id, String(p.days)],
      );
      await q.query("delete from ika_premium_grants where payment_id = $1", [p.id]);
    } else if (p.applied_at) {
      await q.query(
        `update ika_listings set updated_at = now(),
           featured_until = case when featured_until - ($2 || ' days')::interval > now() then featured_until - ($2 || ' days')::interval else null end
         where id = $1 and featured_until is not null`,
        [p.listing_id, String(p.days)],
      );
    }
  }

  /** Paiements restés en attente depuis plus de 24 h : marqués EXPIRED. Une confirmation tardive du fournisseur reste honorée. */
  async function expirePending() {
    const rows = await db.query(
      "update ika_payments set status = 'EXPIRED' where status = 'PENDING' and created_at < now() - interval '24 hours' returning id",
    );
    return rows.length;
  }

  /** Crée la page de paiement chez le fournisseur pour un paiement déjà enregistré (PENDING). En cas d'échec, le paiement est marqué FAILED. */
  async function startWithProvider(userId, id, offer) {
    const who = (await db.query("select u.email, u.name, p.phone from ika_users u left join ika_profiles p on p.user_id = u.id where u.id = $1", [userId]))[0] ?? {};
    let created;
    try {
      created = await provider.createCheckout({ id, amountXof: offer.price_xof, label: offer.label, customer: { id: userId, name: who.name, email: who.email, phone: who.phone } });
    } catch (error) {
      // Le fournisseur n'a pas pu créer le paiement : on le marque échoué (la place « à la une » est libérée) et on le dit clairement.
      await db.query("update ika_payments set status = 'FAILED' where id = $1 and status = 'PENDING'", [id]);
      throw conflict(error instanceof Error && error.message ? error.message : "Le paiement n'a pas pu être créé. Réessayez plus tard.");
    }
    const { providerRef, instructions, paymentUrl = null } = created;
    await db.query("update ika_payments set provider_ref = $2, checkout_url = $3 where id = $1", [id, providerRef, paymentUrl]);
    const row = (await db.query("select * from ika_payments where id = $1", [id]))[0];
    return { payment: view(row), instructions, paymentUrl };
  }

  /** Achat d'un abonnement Premium : pas d'annonce, pas de plafond. Une demande identique encore en attente est reprise, pas dupliquée. */
  async function checkoutPremium(userId, offer, origin = null) {
    const profile = (await db.query("select user_id from ika_profiles where user_id = $1", [userId]))[0];
    if (!profile) throw notFound("Profil introuvable. Complétez votre profil avant de passer Premium.");
    const reserved = await db.transaction(async (tx) => {
      await tx.query("select pg_advisory_xact_lock(hashtext($1))", [`premium:${userId}`]);
      const open = (await tx.query(
        "select * from ika_payments where user_id = $1 and kind = 'PREMIUM' and offer_code = $2 and status = 'PENDING' and created_at > now() - interval '30 minutes'",
        [userId, offer.code],
      ))[0];
      if (open) return { open };
      const id = newId("pay");
      await tx.query(
        "insert into ika_payments (id, user_id, listing_id, offer_code, days, amount_xof, provider, kind, origin) values ($1,$2,null,$3,$4,$5,$6,'PREMIUM',$7)",
        [id, userId, offer.code, offer.days, offer.price_xof, provider.name, premiumOrigin(origin)],
      );
      return { id };
    });
    if (reserved.open) return { payment: view(reserved.open), instructions: "Paiement déjà en cours pour cet abonnement.", paymentUrl: reserved.open.checkout_url ?? null };
    return startWithProvider(userId, reserved.id, offer);
  }

  return {
    enabled,

    /** Offres que le public peut acheter : actives et avec un vrai prix. */
    async offers() {
      if (!enabled()) return { enabled: false, offers: [] };
      const rows = await db.query("select code, label, days, price_xof, kind from ika_offers where active and price_xof > 0 order by kind, days");
      return { enabled: true, offers: rows.map((r) => ({ code: r.code, label: r.label, days: r.days, priceXof: r.price_xof, kind: r.kind })) };
    },

    async adminOffers(userId) {
      await accounts.requireStaff(userId, "ADMIN");
      const rows = await db.query("select code, label, days, price_xof, active, kind from ika_offers order by kind, days");
      return rows.map((r) => ({ code: r.code, label: r.label, days: r.days, priceXof: r.price_xof, active: r.active, kind: r.kind }));
    },

    async setOffer(userId, code, { priceXof, active }) {
      await accounts.requireStaff(userId, "ADMIN");
      const price = Number(priceXof);
      if (!Number.isInteger(price) || price < 0 || price > MAX_PRICE_XOF) throw badRequest("Prix invalide (entier en FCFA).");
      if (active && price === 0) throw badRequest("Une offre active doit avoir un prix.");
      await db.transaction(async (tx) => {
        const rows = await tx.query(
          "update ika_offers set price_xof = $2, active = $3, updated_at = now() where code = $1 returning code",
          [String(code).slice(0, 40), price, Boolean(active)],
        );
        if (!rows[0]) throw notFound("Offre introuvable.");
        await accounts.audit(userId, "OFFER_SET", null, `${code} ${price} ${active ? "active" : "inactive"}`, tx);
      });
      return { ok: true };
    },

    /** Démarre un paiement. Une demande identique encore en attente est reprise, pas dupliquée. */
    async checkout(userId, { offerCode, listingId, from }) {
      if (!enabled()) throw forbidden("Les paiements ne sont pas encore ouverts.");
      await accounts.requireActive(userId);
      const offer = (await db.query("select * from ika_offers where code = $1 and active and price_xof > 0", [String(offerCode ?? "").slice(0, 40)]))[0];
      if (!offer) throw notFound("Offre indisponible.");
      if (offer.kind === "PREMIUM") return checkoutPremium(userId, offer, from);
      const listing = (await db.query("select id, owner_id, status, visibility, featured_until from ika_listings where id = $1", [String(listingId ?? "").slice(0, 80)]))[0];
      if (!listing || listing.owner_id !== userId) throw notFound("Annonce introuvable.");
      if (listing.status !== "PUBLISHED" || listing.visibility === "HIDDEN") throw badRequest("Seule une annonce publiée et visible peut être mise à la une.");
      const live = listing.featured_until && new Date(listing.featured_until) > new Date();
      const cap = await featuredCap();
      // Le contrôle du plafond et la réservation de la place (le paiement en attente) se font sous verrou,
      // dans une seule transaction : deux achats simultanés ne peuvent plus dépasser le plafond.
      // Une place est occupée par une annonce à la une OU par un paiement en attente de moins de 30 minutes.
      const reserved = await db.transaction(async (tx) => {
        await tx.query("select pg_advisory_xact_lock(727002)");
        if (!live) {
          const taken = await tx.query(
            `select count(*)::int as n from (
               select id from ika_listings where featured_until > now() and id <> $1
               union
               select listing_id from ika_payments
               where status = 'PENDING' and kind = 'BOOST' and created_at > now() - interval '30 minutes' and listing_id <> $1
             ) t`,
            [listing.id],
          );
          try { assertFeaturedCap(Number(taken[0]?.n ?? 0), cap); } catch { throw conflict("Les places « à la une » sont toutes prises pour le moment. Réessayez plus tard."); }
        }
        const open = (await tx.query(
          "select * from ika_payments where user_id = $1 and listing_id = $2 and offer_code = $3 and status = 'PENDING' and created_at > now() - interval '30 minutes'",
          [userId, listing.id, offer.code],
        ))[0];
        if (open) return { open };
        const newPayId = newId("pay");
        await tx.query(
          `insert into ika_payments (id, user_id, listing_id, offer_code, days, amount_xof, provider) values ($1,$2,$3,$4,$5,$6,$7)`,
          [newPayId, userId, listing.id, offer.code, offer.days, offer.price_xof, provider.name],
        );
        return { id: newPayId };
      });
      if (reserved.open) return { payment: view(reserved.open), instructions: "Paiement déjà en cours pour cette annonce.", paymentUrl: reserved.open.checkout_url ?? null };
      return startWithProvider(userId, reserved.id, offer);
    },

    /**
     * Réception d'une confirmation du fournisseur. Signature vérifiée, événement dédoublonné, montant contrôlé.
     * Tout se passe dans UNE transaction : l'événement n'est marqué « déjà vu » que si son traitement a réussi.
     * Si le traitement échoue (base coupée, redémarrage, paiement pas encore enregistré), la transaction est annulée,
     * l'événement n'est pas retenu et la relance du fournisseur sera traitée normalement.
     */
    async webhook(rawBody, headers) {
      if (!enabled()) throw forbidden("Paiements désactivés.");
      let event;
      try { event = await provider.parseWebhook(String(rawBody ?? ""), headers); } catch { throw forbidden("Signature refusée."); }
      // Paiement pas encore terminé chez le fournisseur (ex. en attente de la validation du client) : rien à faire, il renverra une notification.
      if (event.ignore) return { ok: true, ignored: "pending" };
      if (!event.eventId || !event.providerRef) throw badRequest("Événement incomplet.");
      const result = await db.transaction(async (tx) => {
        const fresh = await tx.query(
          "insert into ika_payment_events (provider, event_id) values ($1,$2) on conflict do nothing returning event_id",
          [provider.name, event.eventId.slice(0, 120)],
        );
        // Un événement déjà enregistré l'a été par une transaction validée : son traitement est complet.
        if (!fresh[0]) return { ok: true, duplicate: true };
        const p = (await tx.query(
          "select * from ika_payments where provider = $1 and provider_ref = $2 for update",
          [provider.name, event.providerRef.slice(0, 120)],
        ))[0];
        // Paiement inconnu (référence pas encore enregistrée) : on annule, donc l'événement n'est pas retenu et le fournisseur réessaiera.
        if (!p) throw notFound("Paiement inconnu.");
        if (event.status === "FAILED") {
          await tx.query("update ika_payments set status = 'FAILED' where id = $1 and status = 'PENDING'", [p.id]);
          return { ok: true };
        }
        if (event.status === "REFUNDED") {
          // Seuls les remboursements complets sont gérés. Un montant différent est tracé au journal, rien n'est modifié.
          if (event.amountXof !== p.amount_xof) {
            await accounts.audit("provider", "PAYMENT_REFUND_PARTIAL", p.listing_id, `${p.id} : ${event.amountXof} sur ${p.amount_xof} FCFA, à traiter à la main`, tx);
            return { ok: true, ignored: "partial" };
          }
          if (p.status === "PAID") {
            await refundPaid(tx, p, { by: "provider", reason: "Remboursement confirmé par le fournisseur", refundRef: event.refundRef, confirmed: true });
            await accounts.audit("provider", "PAYMENT_REFUND", p.listing_id, `${p.id} remboursé chez le fournisseur`, tx);
          } else if (p.status === "REFUNDED") {
            // Remboursement noté par un administrateur : le fournisseur le confirme, c'est le rapprochement.
            await tx.query(
              "update ika_payments set refund_confirmed_at = coalesce(refund_confirmed_at, now()), refund_ref = coalesce(refund_ref, nullif($2, '')) where id = $1",
              [p.id, String(event.refundRef ?? "").slice(0, 120)],
            );
          }
          return { ok: true };
        }
        if (event.amountXof !== p.amount_xof) {
          await tx.query("update ika_payments set status = 'MISMATCH' where id = $1 and status in ('PENDING','EXPIRED')", [p.id]);
          return { ok: true, mismatch: true };
        }
        // Un seul événement « paiement confirmé » : seulement si CETTE notification fait passer le paiement à PAID (une 2e notification distincte pour un paiement déjà payé n'en produit pas).
        const moved = await tx.query("update ika_payments set status = 'PAID', paid_at = now() where id = $1 and status in ('PENDING','FAILED','EXPIRED') returning id", [p.id]);
        await apply(p.id, tx);
        return moved[0] ? { ok: true, completed: { userId: p.user_id, listingId: p.listing_id, metadata: { kind: p.kind ?? "BOOST", ...(p.kind === "PREMIUM" ? { from: premiumOrigin(p.origin) } : {}) } } } : { ok: true, alreadyPaid: true };
      });
      if (result.completed) onPaid?.(result.completed);
      return result.completed ? { ok: true } : result;
    },

    async mine(userId) {
      const rows = await db.query(
        `select p.*, i.number as invoice from ika_payments p left join ika_invoices i on i.payment_id = p.id
         where p.user_id = $1 order by p.created_at desc limit 50`,
        [userId],
      );
      return rows.map(view);
    },

    async invoice(userId, paymentId) {
      const rows = await db.query(
        `select i.*, u.name from ika_invoices i join ika_users u on u.id = i.user_id where i.payment_id = $1 and i.user_id = $2`,
        [String(paymentId).slice(0, 80), userId],
      );
      if (!rows[0]) throw notFound("Facture introuvable.");
      const r = rows[0];
      return { number: r.number, label: r.label, amountXof: r.amount_xof, issuedAt: r.issued_at, customer: r.customer_name ?? r.name, note: "Facture simple émise par Ika So. Mentions légales à valider par le propriétaire." };
    },

    /** Rapprochement : ce qui demande l'œil d'un administrateur. Réapplique aussi ce qui est payé mais pas encore appliqué. */
    async reconcile(userId) {
      await accounts.requireStaff(userId, "ADMIN");
      const expired = await expirePending();
      const stuck = await db.query("select id from ika_payments where status = 'PAID' and applied_at is null");
      let repaired = 0;
      for (const r of stuck) if (await applyAtomic(r.id)) repaired += 1;
      const rows = await db.query(
        `select * from ika_payments where status = 'MISMATCH' or (status = 'PENDING' and created_at < now() - interval '1 hour')
         order by created_at desc limit 100`,
      );
      const totals = await db.query("select coalesce(sum(amount_xof),0)::bigint as total, count(*)::int as n from ika_payments where status = 'PAID'");
      const refunded = await db.query("select coalesce(sum(amount_xof),0)::bigint as total, count(*)::int as n from ika_payments where status = 'REFUNDED'");
      // Remboursements notés par un administrateur mais pas encore confirmés par le fournisseur : à rapprocher.
      const toConfirm = await db.query("select * from ika_payments where status = 'REFUNDED' and refund_confirmed_at is null order by refunded_at asc limit 100");
      // Paiements encore remboursables (les plus récents d'abord).
      const refundable = await db.query("select * from ika_payments where status = 'PAID' order by paid_at desc nulls last limit 30");
      return {
        repaired, expired, toReview: rows.map(view),
        paid: { count: totals[0].n, totalXof: Number(totals[0].total) },
        refunded: { count: refunded[0].n, totalXof: Number(refunded[0].total) },
        refundsToConfirm: toConfirm.map(view), refundable: refundable.map(view),
      };
    },

    /**
     * Remboursement noté (l'argent est rendu chez le fournisseur). Rejouable : un second appel ne change rien et ne double pas le journal.
     * Retire de l'annonce les jours de ce paiement ; reste « à confirmer » tant que le fournisseur n'a pas confirmé.
     */
    async markRefunded(userId, paymentId, reason, { refundRef = "" } = {}) {
      await accounts.requireStaff(userId, "ADMIN");
      if (!String(reason ?? "").trim()) throw badRequest("Le motif est obligatoire.");
      return db.transaction(async (tx) => {
        const p = (await tx.query("select * from ika_payments where id = $1 for update", [String(paymentId).slice(0, 80)]))[0];
        if (!p) throw notFound("Paiement introuvable.");
        if (p.status === "REFUNDED") return { ok: true, alreadyRefunded: true };
        if (p.status !== "PAID") throw conflict("Seul un paiement confirmé peut être remboursé.");
        await refundPaid(tx, p, { by: userId, reason: String(reason).trim(), refundRef });
        await accounts.audit(userId, "PAYMENT_REFUND", p.listing_id, String(reason).slice(0, 300), tx);
        return { ok: true };
      });
    },

    expirePending,
  };
}
