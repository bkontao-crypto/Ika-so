-- Demandes Premium plus complètes : type de compte, téléphone de contact, message, acceptation des conditions, annulation par l'annonceur.
alter table ika_premium_requests add column if not exists account_type text not null default 'OTHER';
alter table ika_premium_requests add column if not exists phone text not null default '';
alter table ika_premium_requests add column if not exists message text not null default '';
alter table ika_premium_requests add column if not exists accepted_terms_at timestamptz;
alter table ika_premium_requests add column if not exists cancelled_at timestamptz;
alter table ika_premium_requests drop constraint if exists ika_premium_requests_status_check;
alter table ika_premium_requests add constraint ika_premium_requests_status_check check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'));
alter table ika_premium_requests drop constraint if exists ika_premium_requests_account_type_check;
alter table ika_premium_requests add constraint ika_premium_requests_account_type_check check (account_type in ('AGENCY', 'INDIVIDUAL', 'OTHER'));
