-- 0010_company_details.sql
-- Dodaje pola firmowe do organizacji — wykorzystywane przy podpisywaniu umów
-- koncertowych i innych dokumentach. Wszystkie pola opcjonalne (text).

alter table public.organizations
  add column if not exists legal_name            text,  -- pełna nazwa prawna (np. "ACME Sp. z o.o.")
  add column if not exists tax_id                text,  -- NIP / VAT ID
  add column if not exists registration_number   text,  -- REGON / numer rejestrowy
  add column if not exists court_register_number text,  -- KRS / Companies House
  add column if not exists bank_account          text,  -- IBAN
  add column if not exists bank_name             text,
  add column if not exists signatory_name        text,  -- osoba reprezentująca (do umów)
  add column if not exists signatory_position    text,  -- stanowisko reprezentanta
  add column if not exists contact_email         text,
  add column if not exists contact_phone         text,
  add column if not exists website               text;
