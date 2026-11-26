-- Retour arrière de la migration 096 (aucune donnée supprimée : seul le déclencheur disparaît).
drop trigger if exists ika_team_cap_guard on ika_team_links;
drop function if exists ika_team_cap_guard();
