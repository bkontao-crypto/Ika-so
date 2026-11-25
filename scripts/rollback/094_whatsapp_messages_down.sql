-- Retour arrière de 094_whatsapp_messages.sql : supprime uniquement la table de l'historique WhatsApp (aucune autre donnée touchée).
-- Tout ou rien (transaction) ; la ligne _migrations est effacée pour que la migration puisse être rejouée.
begin;
drop table if exists ika_whatsapp_messages;
delete from _migrations where name = '094_whatsapp_messages.sql';
commit;
