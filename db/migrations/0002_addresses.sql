-- ============================================================================
-- Concertivo — migracja 0002: adresy użytkowników i organizacji
-- ============================================================================
-- INSTRUKCJA URUCHOMIENIA:
-- 1. Otwórz panel zewnętrznego Supabase → SQL Editor → New query
-- 2. Wklej CAŁY ten plik
-- 3. Kliknij Run
--
-- Plik jest IDEMPOTENTNY (można uruchamiać wielokrotnie bezpiecznie).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles: adres użytkownika (opcjonalny)
-- ----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists address_street       text,
  add column if not exists address_city         text,
  add column if not exists address_postal_code  text,
  add column if not exists address_country      text;

-- ----------------------------------------------------------------------------
-- organizations: adres siedziby / bazy organizacji (opcjonalny)
-- ----------------------------------------------------------------------------

alter table public.organizations
  add column if not exists address_street       text,
  add column if not exists address_city         text,
  add column if not exists address_postal_code  text,
  add column if not exists address_country      text;
