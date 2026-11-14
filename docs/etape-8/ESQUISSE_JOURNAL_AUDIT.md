# Esquisse — Journal d’audit des actions de modération

**Objectif :** tracer les actions sensibles (badges, restrictions, masquage, résolution de réclamations) de façon simple et additive.

## Modèle proposé (migration additive)

```sql
create table ika_moderation_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references ika_users(id),
  action text not null,               -- ex. 'badge_grant', 'badge_revoke', 'listing_hide', 'user_restrict', 'complaint_resolve'
  target_type text not null,          -- 'listing' | 'user' | 'complaint' | 'document'
  target_id uuid,
  details jsonb,                       -- raison, ancienne valeur, nouvelle valeur
  created_at timestamptz not null default now()
);

create index on ika_moderation_audit (target_type, target_id, created_at desc);
create index on ika_moderation_audit (actor_id, created_at desc);
```

## Usages
- Consultation dans le centre d’administration (filtre par cible ou acteur).
- Export pour revue.
- Pas de suppression (append-only).

## Prochaines étapes d’implémentation
1. Migration.
2. Service `moderation-audit.js` (log simple).
3. Appels depuis les endpoints de modération existants.
4. Vue lecture seule dans `/admin`.

**Statut :** esquisse prête. À valider avant implémentation.
