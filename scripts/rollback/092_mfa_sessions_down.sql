-- Retour arrière de 092_mfa_sessions.sql : retire la seule colonne ajoutée (aucune autre donnée touchée).
-- Tout ou rien (transaction) ; la ligne _migrations est effacée pour que la migration puisse être rejouée.
begin;
alter table ika_sessions drop column if exists mfa_verified_at;
delete from _migrations where name = '092_mfa_sessions.sql';
commit;
