-- Retour arrière de la migration 077 : supprime le registre des exceptions (les conditions officielles, dans les réglages, restent).
begin;
drop table if exists ika_rule_exceptions;
delete from _migrations where name = '077_exceptions_regles.sql';
commit;
