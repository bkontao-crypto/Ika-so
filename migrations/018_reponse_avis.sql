-- Droit de réponse : l'annonceur peut répondre une fois (modifiable) à chaque avis reçu. Additive seulement.
alter table ika_reviews add column if not exists reply_body text;
alter table ika_reviews add column if not exists reply_at timestamptz;
