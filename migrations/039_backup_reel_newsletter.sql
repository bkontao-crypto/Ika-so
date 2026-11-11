-- Sauvegardes réelles (fichier pg_dump vérifié) et newsletters honnêtes. Additive, idempotente.
-- Retour arrière : scripts/rollback/039_backup_reel_newsletter_down.sql
alter table ika_backup_log add column if not exists status text not null default 'LOGGED';
alter table ika_backup_log add column if not exists file_name text;
alter table ika_backup_log add column if not exists size_bytes bigint;
alter table ika_backup_log add column if not exists sha256 text;
alter table ika_backup_log add column if not exists verified_at timestamptz;
alter table ika_backup_log add column if not exists error text;
-- LOGGED = simple note (aucun fichier) ; OK = fichier créé et vérifié ; FAILED = échec ; les anciennes lignes restent LOGGED.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ika_backup_log_status_check') then
    alter table ika_backup_log add constraint ika_backup_log_status_check check (status in ('LOGGED', 'OK', 'FAILED'));
  end if;
end $$;

-- Newsletter : le statut SENT n'est posé qu'après un envoi réel ; le consentement est explicite (loi n° 2013-015, art. 3).
alter table ika_newsletters add column if not exists recipients integer;
alter table ika_newsletters add column if not exists failed integer;
alter table ika_newsletters add column if not exists last_error text;
create table if not exists ika_newsletter_optin (
  user_id text primary key references ika_users(id) on delete cascade,
  opted_in_at timestamptz not null default now()
);
