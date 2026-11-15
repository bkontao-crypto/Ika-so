-- BUG-004 (lot 4) : trois permissions nommées ajoutées à celles de la migration 025, décidées par le propriétaire le 15 novembre 2026.
-- Migration additive : aucune table ni colonne modifiée, aucune donnée existante touchée, relançable sans effet (on conflict do nothing).
--   contenu.gerer : partenaires, page d'accueil, mise en avant d'une annonce (niveau ADMIN, comme avant) — délégable
--   offres.tarifs : modifier le prix d'une offre (SUPERADMIN par défaut) — délégable à un administrateur précis
--   owner.stats   : statistiques réservées au Superadmin — NON délégable
-- Reflète server/lib/permissions.js (un test vérifie la concordance). Retour arrière : scripts/rollback/065_permissions_contenu_offres_owner_down.sql
insert into ika_permissions (code, label, delegable) values
  ('contenu.gerer', 'Gérer partenaires, page d''accueil et mise en avant des annonces', true),
  ('offres.tarifs', 'Modifier le prix d''une offre', true),
  ('owner.stats', 'Consulter les statistiques réservées au Superadmin', false)
on conflict (code) do nothing;

insert into ika_role_permissions (role, permission_code) values
  ('ADMIN', 'contenu.gerer'),
  ('SUPERADMIN', 'contenu.gerer'),
  ('SUPERADMIN', 'offres.tarifs'),
  ('SUPERADMIN', 'owner.stats')
on conflict do nothing;
