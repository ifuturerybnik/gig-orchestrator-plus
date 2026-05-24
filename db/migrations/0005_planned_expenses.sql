-- 0005_planned_expenses.sql
-- Dodaje tabelę "Przyszłe wydatki / wpływy" dla organizacji.
-- Uruchom ręcznie w panelu zewnętrznego Supabase (SQL editor).

create table if not exists public.organization_planned_expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  entry_date date not null default current_date,
  description text not null check (length(description) between 1 and 500),
  kind public.budget_entry_kind not null,
  planned_date date not null,
  amount_gross numeric(14, 2) not null check (amount_gross >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists planned_expenses_org_idx
  on public.organization_planned_expenses (organization_id, planned_date desc);

comment on table public.organization_planned_expenses is
  'Planowane (przyszłe) wpływy i wydatki organizacji.';

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.organization_planned_expenses enable row level security;

drop policy if exists "planned_select_member_or_admin" on public.organization_planned_expenses;
create policy "planned_select_member_or_admin" on public.organization_planned_expenses
  for select to authenticated
  using (
    public.is_member_of(auth.uid(), organization_id)
    or public.is_admin(auth.uid())
  );

drop policy if exists "planned_insert_member_or_admin" on public.organization_planned_expenses;
create policy "planned_insert_member_or_admin" on public.organization_planned_expenses
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      public.is_member_of(auth.uid(), organization_id)
      or public.is_admin(auth.uid())
    )
  );

drop policy if exists "planned_update_member_or_admin" on public.organization_planned_expenses;
create policy "planned_update_member_or_admin" on public.organization_planned_expenses
  for update to authenticated
  using (
    public.is_member_of(auth.uid(), organization_id)
    or public.is_admin(auth.uid())
  )
  with check (
    public.is_member_of(auth.uid(), organization_id)
    or public.is_admin(auth.uid())
  );

drop policy if exists "planned_delete_owner_or_self_or_admin" on public.organization_planned_expenses;
create policy "planned_delete_owner_or_self_or_admin" on public.organization_planned_expenses
  for delete to authenticated
  using (
    created_by = auth.uid()
    or public.is_owner_of(auth.uid(), organization_id)
    or public.is_admin(auth.uid())
  );
