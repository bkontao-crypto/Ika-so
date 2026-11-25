-- Phase 2 (comptes) : deux emplacements Superadmin (principal et secondaire) et réglage « MFA obligatoire ».
-- Migration additive : une colonne nullable, un index, deux lignes de réglages. Aucune donnée existante n'est modifiée sauf le remplissage des emplacements.
-- Les deux Superadmin existants les plus anciens prennent PRINCIPAL puis SECONDARY ; un éventuel surplus reste SUPERADMIN sans emplacement (à régulariser par le propriétaire, jamais supprimé ici).
-- Retour arrière : scripts/rollback/093_superadmin_emplacements_down.sql
alter table ika_profiles add column if not exists superadmin_slot text check (superadmin_slot in ('PRINCIPAL', 'SECONDARY'));
create unique index if not exists ika_profiles_superadmin_slot_uidx on ika_profiles (superadmin_slot) where superadmin_slot is not null;
update ika_profiles p set superadmin_slot = r.slot
from (
  select user_id, case row_number() over (order by created_at, user_id) when 1 then 'PRINCIPAL' else 'SECONDARY' end as slot
  from ika_profiles where staff_role = 'SUPERADMIN' and superadmin_slot is null
  order by created_at, user_id limit 2
) r
where p.user_id = r.user_id
  and not exists (select 1 from ika_profiles x where x.superadmin_slot = r.slot);
alter table ika_profiles add constraint ika_profiles_superadmin_slot_role_chk check (superadmin_slot is null or staff_role = 'SUPERADMIN');
insert into ika_settings (key, value) values ('mfa_required', 'false') on conflict do nothing;
