-- Index pour accélérer le calcul du taux de réponse sur les profils publics.
-- Additive.
create index if not exists ika_messages_thread_sender_idx on ika_messages (thread_id, sender_id);
