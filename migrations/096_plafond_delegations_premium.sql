-- Migration 096 — Plafond de 10 comptes délégués pour un compte Premium (invitations d'équipe).
-- Additive : un déclencheur, aucune donnée modifiée. Il ne s'applique qu'aux NOUVELLES invitations d'un compte Premium actif :
-- les liens d'équipe existants sont conservés tels quels, et les comptes non Premium ne sont pas concernés.
-- Sont comptées les invitations envoyées en attente ou acceptées ; refusées, annulées et retirées libèrent une place.

create or replace function ika_team_cap_guard() returns trigger language plpgsql as $$
declare
  held int;
begin
  if new.status not in ('PENDING', 'ACCEPTED') then return new; end if;
  if tg_op = 'UPDATE' and old.status in ('PENDING', 'ACCEPTED') then return new; end if;
  if not exists (select 1 from ika_profiles where user_id = new.requester_id and premium_until > now()) then return new; end if;
  -- Deux invitations simultanées du même compte sont traitées l'une après l'autre.
  perform pg_advisory_xact_lock(hashtext('team_cap:' || new.requester_id));
  select count(*) into held from ika_team_links
    where requester_id = new.requester_id and status in ('PENDING', 'ACCEPTED') and id <> new.id;
  if held >= 10 then
    raise exception 'Plafond de 10 comptes délégués atteint pour ce compte Premium.' using errcode = 'IK010';
  end if;
  return new;
end;
$$;

drop trigger if exists ika_team_cap_guard on ika_team_links;
create trigger ika_team_cap_guard before insert or update of status on ika_team_links
  for each row execute function ika_team_cap_guard();
