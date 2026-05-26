-- 0018_counterparties_dedup.sql
-- Tura B: kontrahenci współdzieleni + dedup + prośby o dołączenie (claim).
--
-- 1. Domyślnie nowe organizacje trafiają do bazy współdzielonej (is_shared = true).
-- 2. Tabela `organization_join_requests` — claim istniejącej organizacji przez innego usera.
-- 3. Indeks trigramowy na `organizations.name` (case-insensitive fuzzy search).
-- 4. Polityka SELECT dla authenticated: każdy zalogowany user widzi shared+approved
--    (tylko bezpieczne kolumny — zob. server fn searchSharedOrganizations).
--
-- Uruchom RĘCZNIE w panelu zewnętrznego Supabase (SQL editor).

-- 1. Domyślnie is_shared = true
alter table public.organizations
  alter column is_shared set default true;

-- 2. Wyszukiwanie po nazwie (pg_trgm z migracji 0016)
create extension if not exists pg_trgm;
create index if not exists idx_organizations_name_trgm
  on public.organizations using gin (lower(name) gin_trgm_ops);
create index if not exists idx_organizations_tax_id
  on public.organizations (tax_id);

-- 3. Polityka SELECT dla bazy współdzielonej
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'organizations'
      and policyname = 'organizations_select_shared'
  ) then
    create policy organizations_select_shared
      on public.organizations
      for select
      to authenticated
      using (is_shared = true and status = 'approved');
  end if;
end $$;

-- 4. Tabela próśb o dołączenie
create table if not exists public.organization_join_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uniq_org_join_req_pending
  on public.organization_join_requests (organization_id, user_id)
  where status = 'pending';

create index if not exists idx_org_join_req_status on public.organization_join_requests (status);
create index if not exists idx_org_join_req_user on public.organization_join_requests (user_id);
create index if not exists idx_org_join_req_org on public.organization_join_requests (organization_id);

-- 5. GRANTY
grant select, insert, update, delete on public.organization_join_requests to authenticated;
grant all on public.organization_join_requests to service_role;

-- 6. RLS
alter table public.organization_join_requests enable row level security;

drop policy if exists ojr_select_own on public.organization_join_requests;
create policy ojr_select_own
  on public.organization_join_requests
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists ojr_select_admin on public.organization_join_requests;
create policy ojr_select_admin
  on public.organization_join_requests
  for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    or public.has_role(auth.uid(), 'admin_staff'::app_role)
  );

drop policy if exists ojr_insert_own on public.organization_join_requests;
create policy ojr_insert_own
  on public.organization_join_requests
  for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists ojr_update_own on public.organization_join_requests;
create policy ojr_update_own
  on public.organization_join_requests
  for update
  to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status in ('pending', 'cancelled'));

drop policy if exists ojr_update_admin on public.organization_join_requests;
create policy ojr_update_admin
  on public.organization_join_requests
  for update
  to authenticated
  using (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    or public.has_role(auth.uid(), 'admin_staff'::app_role)
  )
  with check (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    or public.has_role(auth.uid(), 'admin_staff'::app_role)
  );

-- 7. Auto-update updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ojr_touch on public.organization_join_requests;
create trigger trg_ojr_touch
  before update on public.organization_join_requests
  for each row execute function public.touch_updated_at();

comment on table public.organization_join_requests is
  'Tura B: prośby o dołączenie do istniejącej organizacji znalezionej w bazie kontrahentów. Akceptuje admin.';
