-- 0004_currency_and_budget.sql
-- Dodaje walutę organizacji oraz tabelę pozycji budżetowych.
-- Uruchom ręcznie w panelu zewnętrznego Supabase (SQL editor).

-- ----------------------------------------------------------------------------
-- 1. Waluta organizacji (ISO 4217, np. PLN, EUR, USD)
-- ----------------------------------------------------------------------------
alter table public.organizations
  add column if not exists currency text not null default 'PLN';

alter table public.organizations
  drop constraint if exists organizations_currency_format;
alter table public.organizations
  add constraint organizations_currency_format
  check (currency ~ '^[A-Z]{3}$');

comment on column public.organizations.currency is
  'Waluta domyślna organizacji (ISO 4217). Używana w module budżetu.';

-- ----------------------------------------------------------------------------
-- 2. Typ pozycji budżetowej
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.budget_entry_kind as enum ('income', 'expense');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 3. Tabela pozycji budżetowych
-- ----------------------------------------------------------------------------
create table if not exists public.organization_budget_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  entry_date date not null default current_date,
  description text not null check (length(description) between 1 and 500),
  kind public.budget_entry_kind not null,
  amount_gross numeric(14, 2) not null check (amount_gross >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now()
);

create index if not exists budget_entries_org_idx
  on public.organization_budget_entries (organization_id, entry_date desc);

comment on table public.organization_budget_entries is
  'Pozycje budżetowe organizacji: wpływy i wydatki z kwotą brutto i walutą.';

-- ----------------------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------------------
alter table public.organization_budget_entries enable row level security;

drop policy if exists "budget_select_member_or_admin" on public.organization_budget_entries;
create policy "budget_select_member_or_admin" on public.organization_budget_entries
  for select to authenticated
  using (
    public.is_member_of(auth.uid(), organization_id)
    or public.is_admin(auth.uid())
  );

drop policy if exists "budget_insert_member_or_admin" on public.organization_budget_entries;
create policy "budget_insert_member_or_admin" on public.organization_budget_entries
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      public.is_member_of(auth.uid(), organization_id)
      or public.is_admin(auth.uid())
    )
  );

drop policy if exists "budget_delete_owner_or_self_or_admin" on public.organization_budget_entries;
create policy "budget_delete_owner_or_self_or_admin" on public.organization_budget_entries
  for delete to authenticated
  using (
    created_by = auth.uid()
    or public.is_owner_of(auth.uid(), organization_id)
    or public.is_admin(auth.uid())
  );
