# Esquisse — CRM Professionnels (E07 lot 1)

**Objectif** : poser les bases d'un CRM léger pour les annonceurs professionnels (agences, promoteurs).

## Modèle proposé (migration additive)

```sql
create table ika_crm_leads (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references ika_users(id),
  listing_id uuid references ika_listings(id),
  contact_name text,
  contact_phone text,
  contact_email text,
  source text,                    -- 'form', 'whatsapp', 'call', 'manual'
  status text not null default 'NEW',  -- NEW, CONTACTED, VISIT, NEGOTIATION, WON, LOST
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on ika_crm_leads (advertiser_id, status, updated_at desc);
create index on ika_crm_leads (listing_id);
```

## Fonctions minimales
- `GET /me/crm/leads` — liste des leads de l'annonceur
- `POST /me/crm/leads` — création manuelle ou depuis un contact
- `PUT /me/crm/leads/:id` — mise à jour statut / notes
- Lien optionnel vers une annonce

## Intégration existante
- Réutilise le centre annonceur (`advertiserCenter`) déjà présent.
- Les contacts WhatsApp/Call déjà tracés (`advertiserProfiles.recordContact`) peuvent alimenter des leads.
- Compatible avec les rôles professionnels et le score.

## Prochaines étapes
1. Migration.
2. Service `crm.js`.
3. Routes `/me/crm/*`.
4. Onglet ou section dans le centre pro.

**Statut** : esquisse prête pour validation.
