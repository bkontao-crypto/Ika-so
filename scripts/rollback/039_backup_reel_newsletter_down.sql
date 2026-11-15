-- Retour arrière de la migration 039.
drop table if exists ika_newsletter_optin;
alter table ika_newsletters drop column if exists last_error;
alter table ika_newsletters drop column if exists failed;
alter table ika_newsletters drop column if exists recipients;
alter table ika_backup_log drop constraint if exists ika_backup_log_status_check;
alter table ika_backup_log drop column if exists error;
alter table ika_backup_log drop column if exists verified_at;
alter table ika_backup_log drop column if exists sha256;
alter table ika_backup_log drop column if exists size_bytes;
alter table ika_backup_log drop column if exists file_name;
alter table ika_backup_log drop column if exists status;
delete from _migrations where name = '039_backup_reel_newsletter.sql'; -- ajouté (BUG-002) : permet de rejouer la migration après le retour arrière
