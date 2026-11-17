-- Retour arrière de la migration 069. Refuse s'il existe des réclamations sans annonce (les clôturer/exporter puis les supprimer avant) : rien n'est supprimé automatiquement.
begin;
do $$ begin
  if exists (select 1 from ika_reports where listing_id is null) then
    raise exception 'Des réclamations sans annonce existent : les exporter puis les supprimer avant ce retour arrière.';
  end if;
end $$;
alter table ika_reports alter column listing_id set not null;
delete from _migrations where name = '069_reclamations_sans_annonce.sql';
commit;
