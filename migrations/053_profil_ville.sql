-- Ville affichée sur le profil (« Vit à … »). Facultative, additive.
alter table ika_advertiser_profiles
  add column if not exists city text check (city is null or length(city) <= 60);
