-- Boîte WhatsApp (Meta Cloud API) : historique des messages reçus et envoyés, pour la page d'administration /whatsapp.
-- Migration additive : une nouvelle table, aucune table existante modifiée. Retour arrière : scripts/rollback/094_whatsapp_messages_down.sql
-- Données personnelles de tiers (numéros, messages) : accès réservé au personnel autorisé (permission « contenu.gerer »).
create table if not exists ika_whatsapp_messages (
  id bigserial primary key,
  wa_message_id text unique,                                              -- identifiant Meta (« wamid… ») ; nul si l'envoi a échoué avant d'en recevoir un
  direction text not null check (direction in ('inbound', 'outbound')),
  phone_number text not null,                                             -- format international sans « + » (ex. 22370000000)
  contact_name text,                                                      -- nom du profil WhatsApp, s'il est fourni
  message_text text,
  status text not null check (status in ('received', 'sent', 'delivered', 'read', 'failed')),
  error_text text,                                                        -- raison de l'échec renvoyée par Meta
  sent_by text references ika_users (id) on delete set null,              -- membre du personnel qui a envoyé (messages sortants)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ika_whatsapp_messages_phone_idx on ika_whatsapp_messages (phone_number, created_at);
create index if not exists ika_whatsapp_messages_created_idx on ika_whatsapp_messages (created_at desc);
