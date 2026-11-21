-- 077 : exceptions aux conditions officielles (« jurisprudence »). Les conditions officielles sont des réglages du superadmin ;
-- une exception lève UNE condition pour UN compte, avec motif obligatoire, auteur tracé, durée facultative, révocable. Rien n'est supprimé.
create table if not exists ika_rule_exceptions (
  id text primary key,
  user_id text not null,
  rule text not null,                 -- clé de la condition levée (voir server/lib/account-rules.js)
  reason text not null,
  granted_by text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,             -- null = jusqu'à révocation
  revoked_at timestamptz,
  revoked_by text,
  revoked_reason text
);
create index if not exists ika_rule_exceptions_user_idx on ika_rule_exceptions (user_id, created_at desc);
-- une seule exception active par compte et par condition
create unique index if not exists ika_rule_exceptions_active_uniq on ika_rule_exceptions (user_id, rule) where revoked_at is null;
