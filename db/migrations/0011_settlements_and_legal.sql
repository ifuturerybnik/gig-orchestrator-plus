-- 0011_settlements_and_legal.sql
-- 1) Preferowana forma rozliczenia użytkownika + dane wrażliwe do umów.
-- 2) Audit log zgód (RODO / regulamin / polityka prywatności).
-- 3) RLS: dane wrażliwe widoczne dla użytkownika, ownerów organizacji do których
--    należy oraz właściciela aplikacji (super_admin = i-Future).
--
-- UWAGA: Pola PESEL / IBAN docelowo powinny być szyfrowane (pgcrypto / vault).
-- Na razie trzymamy plaintext z surowym RLS — patrz TODO niżej.

-- ----------------------------------------------------------------------------
-- 1. ENUM dla formy rozliczenia
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'settlement_form') then
    create type public.settlement_form as enum (
      'employment',        -- Umowa o pracę z organizacją
      'business',          -- Własna działalność gospodarcza (B2B / faktura)
      'mandate_contract',  -- Umowa zlecenie
      'work_contract',     -- Umowa o dzieło
      'other'              -- Inne (np. kontrakt menedżerski)
    );
  end if;
end$$;

-- ----------------------------------------------------------------------------
-- 2. Pola na profilu
-- ----------------------------------------------------------------------------
alter table public.profiles
  -- Wybór formy
  add column if not exists settlement_form              public.settlement_form,
  add column if not exists settlement_employer_org_id   uuid references public.organizations(id) on delete set null,
  add column if not exists settlement_other_description text,

  -- Dane do umów (część wspólna, używane w zależności od formy)
  add column if not exists billing_company_name   text,            -- nazwa firmy (DG)
  add column if not exists billing_tax_id         text,            -- NIP
  add column if not exists billing_is_vat_payer   boolean,         -- VAT-owiec?
  add column if not exists billing_bank_account   text,            -- IBAN
  add column if not exists billing_pesel          text,            -- PESEL (zlecenie/dzieło)
  add column if not exists billing_tax_office     text,            -- Urząd Skarbowy
  add column if not exists billing_zus_title      text,            -- np. 'student', 'emeryt', 'inny tytul'
  add column if not exists billing_default_rate     numeric(12,2), -- domyślna stawka
  add column if not exists billing_default_currency text,          -- kod waluty (PLN, EUR, ...)

  -- Akceptacje
  add column if not exists terms_accepted_at      timestamptz,
  add column if not exists terms_version          text,
  add column if not exists privacy_accepted_at    timestamptz,
  add column if not exists privacy_version        text,
  add column if not exists marketing_consent      boolean not null default false;

-- ----------------------------------------------------------------------------
-- 3. Tabela audytu zgód (każda akceptacja / zmiana = nowy wiersz)
-- ----------------------------------------------------------------------------
create table if not exists public.user_consents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  consent_type text not null,        -- 'terms' | 'privacy' | 'marketing' | 'dpa'
  version      text not null,        -- np. '2026-05-25'
  granted      boolean not null,     -- true = zaakceptowane, false = wycofane
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists user_consents_user_idx on public.user_consents (user_id);
create index if not exists user_consents_type_idx on public.user_consents (consent_type);

alter table public.user_consents enable row level security;

drop policy if exists "user_consents_select_own_or_admin" on public.user_consents;
create policy "user_consents_select_own_or_admin" on public.user_consents
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "user_consents_insert_own" on public.user_consents;
create policy "user_consents_insert_own" on public.user_consents
  for insert to authenticated
  with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. RLS dla profiles — rozszerzamy SELECT
--    Dotychczas: właściciel + admin. Dodajemy: ownerzy organizacji do których
--    profil należy (potrzebują danych do umów koncertowych).
-- ----------------------------------------------------------------------------
create or replace function public.can_view_profile_billing(_profile_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select
    -- sam użytkownik
    _profile_user_id = auth.uid()
    -- właściciel aplikacji (i-Future)
    or public.is_admin(auth.uid())
    -- owner którejkolwiek organizacji do której należy ten user
    or exists (
      select 1
      from public.organization_members owner_mem
      join public.organization_members user_mem
        on owner_mem.organization_id = user_mem.organization_id
      where user_mem.user_id  = _profile_user_id
        and owner_mem.user_id = auth.uid()
        and owner_mem.role    = 'owner'
    );
$$;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_billing_authorized" on public.profiles
  for select to authenticated
  using (public.can_view_profile_billing(id));

-- ----------------------------------------------------------------------------
-- TODO (kolejne migracje):
-- * Szyfrowanie pgcrypto na billing_pesel / billing_bank_account.
-- * Osobna tabela `profile_billing` z węższym RLS (zamiast trzymać na profiles).
-- * Tabela `legal_documents` z wersjami regulaminu/polityki + wymuszenie
--   ponownej akceptacji przy zmianie wersji.
-- ----------------------------------------------------------------------------
