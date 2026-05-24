-- 0003_band_genres.sql
-- Dodaje kolumnę `genres` (lista gatunków muzycznych) do tabeli organizations.
-- Używane głównie dla type = 'band'. Przechowujemy stabilne ID gatunków (snake_case),
-- a etykiety lokalizujemy w UI przez i18next (klucze organizations.genres.<id>).
--
-- Uruchom ręcznie w panelu zewnętrznego Supabase (SQL editor).

alter table public.organizations
  add column if not exists genres text[] not null default '{}';

comment on column public.organizations.genres is
  'Lista gatunków muzycznych zespołu (snake_case IDs, lokalizowane w UI). Pusta dla nie-zespołów.';
