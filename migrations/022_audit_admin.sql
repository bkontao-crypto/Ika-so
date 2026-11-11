-- Phase 2 (analytique) : journal d'audit administrateur, en ajout seul. ika_audit (existante) n'est pas modifiée.
-- Pas de clé étrangère vers les comptes : la ligne d'audit doit survivre à la suppression d'un compte.
-- UPDATE, DELETE et TRUNCATE sont refusés, sauf par ika_admin_audit_purge() (rétention), qui se trace elle-même.
-- Retour arrière : scripts/rollback/022_audit_admin_down.sql
create table if not exists ika_admin_audit (
  id text primary key,
  occurred_at timestamptz not null default now(),
  actor_id text,
  actor_role text not null,
  action text not null,
  object_type text,
  object_id text,
  subject_user_id text,
  country_code char(2),
  result text not null default 'OK' check (result in ('OK', 'DENIED', 'ERROR')),
  old_value jsonb,
  new_value jsonb,
  reason text,
  source text
);
create index if not exists ika_admin_audit_time_idx on ika_admin_audit (occurred_at desc);
create index if not exists ika_admin_audit_actor_idx on ika_admin_audit (actor_id, occurred_at desc);
create index if not exists ika_admin_audit_object_idx on ika_admin_audit (object_type, object_id, occurred_at desc);
create index if not exists ika_admin_audit_action_idx on ika_admin_audit (action, occurred_at desc);

create or replace function ika_admin_audit_guard() returns trigger language plpgsql as $$
begin
  if current_setting('ika.audit_purge', true) = 'on' then
    return coalesce(old, new);
  end if;
  raise exception 'ika_admin_audit est en ajout seul (opération % refusée)', tg_op;
end $$;

drop trigger if exists ika_admin_audit_no_change on ika_admin_audit;
create trigger ika_admin_audit_no_change before update or delete on ika_admin_audit
  for each row execute function ika_admin_audit_guard();
drop trigger if exists ika_admin_audit_no_truncate on ika_admin_audit;
create trigger ika_admin_audit_no_truncate before truncate on ika_admin_audit
  for each statement execute function ika_admin_audit_guard();

-- Purge de rétention : supprime les lignes antérieures à la date donnée et trace l'opération. Renvoie le nombre de lignes supprimées.
create or replace function ika_admin_audit_purge(cutoff timestamptz, purge_id text) returns integer language plpgsql as $$
declare n integer;
begin
  if cutoff > now() - interval '1 year' then
    raise exception 'purge refusée : la date limite doit avoir plus d''un an';
  end if;
  perform set_config('ika.audit_purge', 'on', true);
  delete from ika_admin_audit where occurred_at < cutoff;
  get diagnostics n = row_count;
  perform set_config('ika.audit_purge', 'off', true);
  insert into ika_admin_audit (id, actor_role, action, object_type, new_value, source)
  values (purge_id, 'system', 'audit.purge', 'ika_admin_audit', jsonb_build_object('cutoff', cutoff, 'deleted', n), 'job');
  return n;
end $$;
