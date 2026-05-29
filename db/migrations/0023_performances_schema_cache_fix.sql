-- ============================================================================
-- 0023_performances_schema_cache_fix.sql
-- Naprawa widoczności tabel "Występy" w Data API po ręcznym uruchomieniu SQL.
--
-- Objaw: aplikacja zwraca
--   Could not find the table 'public.performances' in the schema cache
-- mimo że migracja 0022 została wykonana.
-- ============================================================================

do $$ begin
  create type public.performance_status as enum (
    'inquiry',
    'tentative',
    'confirmed_signing',
    'confirmed_signed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.performance_visibility as enum (
    'private',
    'members_date',
    'members_full',
    'public_date',
    'public_full'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.performances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  performance_date date not null,
  status public.performance_status not null,
  visibility public.performance_visibility not null default 'private',
  name text,
  city text,
  postal_code text,
  street text,
  street_number text,
  google_maps_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists performances_org_date_idx
  on public.performances (organization_id, performance_date desc);

create table if not exists public.performance_assignments (
  id uuid primary key default gen_random_uuid(),
  performance_id uuid not null references public.performances(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  counterparty_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint performance_assignments_exactly_one
    check ((contact_id is not null) <> (counterparty_id is not null))
);

create unique index if not exists performance_assignments_contact_uq
  on public.performance_assignments (performance_id, contact_id)
  where contact_id is not null;

create unique index if not exists performance_assignments_counterparty_uq
  on public.performance_assignments (performance_id, counterparty_id)
  where counterparty_id is not null;

grant select, insert, update, delete on public.performances to authenticated;
grant all on public.performances to service_role;
grant select, insert, update, delete on public.performance_assignments to authenticated;
grant all on public.performance_assignments to service_role;

alter table public.performances enable row level security;
alter table public.performance_assignments enable row level security;

drop policy if exists "performances_select_member_or_admin" on public.performances;
create policy "performances_select_member_or_admin" on public.performances
  for select to authenticated
  using (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

drop policy if exists "performances_insert_member_or_admin" on public.performances;
create policy "performances_insert_member_or_admin" on public.performances
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()))
  );

drop policy if exists "performances_update_member_or_admin" on public.performances;
create policy "performances_update_member_or_admin" on public.performances
  for update to authenticated
  using (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()))
  with check (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

drop policy if exists "performances_delete_owner_or_admin" on public.performances;
create policy "performances_delete_owner_or_admin" on public.performances
  for delete to authenticated
  using (
    created_by = auth.uid()
    or public.is_owner_of(auth.uid(), organization_id)
    or public.is_admin(auth.uid())
  );

drop policy if exists "perf_assign_select" on public.performance_assignments;
create policy "perf_assign_select" on public.performance_assignments
  for select to authenticated
  using (
    exists (
      select 1 from public.performances p
      where p.id = performance_id
        and (public.is_member_of(auth.uid(), p.organization_id) or public.is_admin(auth.uid()))
    )
  );

drop policy if exists "perf_assign_write" on public.performance_assignments;
create policy "perf_assign_write" on public.performance_assignments
  for all to authenticated
  using (
    exists (
      select 1 from public.performances p
      where p.id = performance_id
        and (public.is_member_of(auth.uid(), p.organization_id) or public.is_admin(auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.performances p
      where p.id = performance_id
        and (public.is_member_of(auth.uid(), p.organization_id) or public.is_admin(auth.uid()))
    )
  );

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');