-- Connexion Google depuis l'application Android : ticket à usage unique (60 secondes), haché en base.
-- Le navigateur reçoit le ticket puis le transmet à l'application, qui l'échange contre une session dans sa WebView.
create table if not exists ika_login_tickets (
  token_hash text primary key,
  user_id text not null references ika_users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists ika_login_tickets_expires_idx on ika_login_tickets (expires_at);
