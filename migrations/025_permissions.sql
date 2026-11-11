-- Phase 2 (comptes) : permissions nommées, refus par défaut. Migration additive : ika_profiles.staff_role n'est pas modifiée.
-- L'amorçage reproduit les droits actuels par rang (MODERATOR < ADMIN < SUPERADMIN) ; aucun appelant n'est encore branché dessus.
-- Retour arrière : scripts/rollback/025_permissions_down.sql
create table if not exists ika_permissions (
  code text primary key check (code ~ '^[a-z]+(\.[a-z_]+)+$'),
  label text not null,
  delegable boolean not null default true
);

create table if not exists ika_role_permissions (
  role text not null check (role in ('MODERATOR', 'ADMIN', 'SUPERADMIN')),
  permission_code text not null references ika_permissions (code) on delete cascade,
  primary key (role, permission_code)
);

create table if not exists ika_user_permissions (
  user_id text not null references ika_profiles (user_id) on delete cascade,
  permission_code text not null references ika_permissions (code) on delete cascade,
  granted_by text not null,
  granted_at timestamptz not null default now(),
  reason text not null check (length(btrim(reason)) > 0),
  expires_at timestamptz,
  primary key (user_id, permission_code),
  check (granted_by <> user_id)
);
create index if not exists ika_user_permissions_user_idx on ika_user_permissions (user_id);

-- Une permission non délégable (gestion des rôles, des emplacements Superadmin, des permissions) ne peut jamais être accordée à titre individuel.
create or replace function ika_user_permission_guard() returns trigger language plpgsql as $$
begin
  if not (select delegable from ika_permissions where code = new.permission_code) then
    raise exception 'permission non délégable : %', new.permission_code;
  end if;
  return new;
end $$;
drop trigger if exists ika_user_permission_delegable on ika_user_permissions;
create trigger ika_user_permission_delegable before insert or update on ika_user_permissions
  for each row execute function ika_user_permission_guard();

insert into ika_permissions (code, label, delegable) values
  ('moderation.review', 'Contrôler et décider les annonces et contenus', true),
  ('moderation.restrict', 'Restreindre un compte', true),
  ('trust.proof_review', 'Examiner une pièce justificative de bien', true),
  ('trust.agency_badge', 'Accorder le badge Agence vérifiée', true),
  ('trust.badge_remove', 'Retirer un badge', true),
  ('trust.blacklist', 'Gérer la liste noire', true),
  ('account.ban', 'Bloquer un compte', true),
  ('payments.manage', 'Gérer offres, paiements et remboursements', true),
  ('audit.read', 'Consulter le journal d''audit', true),
  ('analytics.read', 'Consulter les statistiques', true),
  ('premium.decide', 'Décider une demande Premium (délégation expresse)', true),
  ('staff.role_change', 'Changer le rôle d''un compte', false),
  ('superadmin.slot_manage', 'Gérer les deux emplacements Superadmin', false),
  ('permissions.grant', 'Accorder ou retirer une permission', false)
on conflict (code) do nothing;

insert into ika_role_permissions (role, permission_code) values
  ('MODERATOR', 'moderation.review'), ('MODERATOR', 'moderation.restrict'), ('MODERATOR', 'trust.proof_review'),
  ('ADMIN', 'moderation.review'), ('ADMIN', 'moderation.restrict'), ('ADMIN', 'trust.proof_review'),
  ('ADMIN', 'trust.agency_badge'), ('ADMIN', 'trust.badge_remove'), ('ADMIN', 'trust.blacklist'),
  ('ADMIN', 'account.ban'), ('ADMIN', 'payments.manage'), ('ADMIN', 'audit.read'), ('ADMIN', 'analytics.read'),
  ('SUPERADMIN', 'moderation.review'), ('SUPERADMIN', 'moderation.restrict'), ('SUPERADMIN', 'trust.proof_review'),
  ('SUPERADMIN', 'trust.agency_badge'), ('SUPERADMIN', 'trust.badge_remove'), ('SUPERADMIN', 'trust.blacklist'),
  ('SUPERADMIN', 'account.ban'), ('SUPERADMIN', 'payments.manage'), ('SUPERADMIN', 'audit.read'), ('SUPERADMIN', 'analytics.read'),
  ('SUPERADMIN', 'premium.decide'), ('SUPERADMIN', 'staff.role_change'),
  ('SUPERADMIN', 'superadmin.slot_manage'), ('SUPERADMIN', 'permissions.grant')
on conflict do nothing;
