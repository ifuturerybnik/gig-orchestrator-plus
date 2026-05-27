-- 0021_counterparty_links.sql
-- Linki user → kontrahent (i przyszłościowo organizacja → kontrahent).
-- Enum modułów + stub funkcji has_module_access (RBAC dorobimy później).
-- Uruchom RĘCZNIE w panelu zewnętrznego Supabase (SQL Editor).

-- 1) Enum modułów aplikacji (do przyszłego RBAC)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_module') then
    create type public.app_module as enum (
      'counterparties', 'contacts', 'correspondence', 'events',
      'budget', 'settlements', 'members', 'admin'
    );
  end if;
end $$;

-- 2) Stub: na razie zawsze TRUE (właściwa implementacja w osobnej migracji)
create or replace function public.has_module_access(
  _user_id uuid,
  _org_id uuid,
  _module public.app_module
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select true;
$$;

-- 3) Enum właściciela linku
do $$
begin
  if not exists (select 1 from pg_type where typname = 'counterparty_owner_kind') then
    create type public.counterparty_owner_kind as enum ('user', 'organization');
  end if;
end $$;

-- 4) Tabela linków
create table if not exists public.counterparty_links (
  id uuid primary key default gen_random_uuid(),
  owner_kind public.counterparty_owner_kind not null,
  owner_user_id uuid references auth.users(id) on delete cascade,
  owner_org_id  uuid references public.organizations(id) on delete cascade,
  counterparty_org_id uuid not null references public.organizations(id) on delete cascade,
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint counterparty_links_owner_xor check (
    (owner_kind = 'user'         and owner_user_id is not null and owner_org_id is null) or
    (owner_kind = 'organization' and owner_org_id  is not null and owner_user_id is null)
  )
);

-- Unikalność per właściciel
create unique index if not exists uniq_counterparty_links_user
  on public.counterparty_links (owner_user_id, counterparty_org_id)
  where owner_kind = 'user';

create unique index if not exists uniq_counterparty_links_org
  on public.counterparty_links (owner_org_id, counterparty_org_id)
  where owner_kind = 'organization';

create index if not exists idx_counterparty_links_user
  on public.counterparty_links (owner_user_id) where owner_kind = 'user';
create index if not exists idx_counterparty_links_org
  on public.counterparty_links (owner_org_id) where owner_kind = 'organization';
create index if not exists idx_counterparty_links_cp
  on public.counterparty_links (counterparty_org_id);

-- Zabezpieczenie: nie linkujemy sami siebie (kontrahent musi być inną organizacją)
-- (na razie nie blokujemy twardo, bo to wymaga znajomości org-id usera; logika w server fn)

-- 5) Granty
grant select, insert, update, delete on public.counterparty_links to authenticated;
grant all on public.counterparty_links to service_role;

-- 6) RLS
alter table public.counterparty_links enable row level security;

drop policy if exists cpl_select_user on public.counterparty_links;
create policy cpl_select_user
  on public.counterparty_links
  for select
  to authenticated
  using (
    owner_kind = 'user' and owner_user_id = auth.uid()
  );

drop policy if exists cpl_select_org on public.counterparty_links;
create policy cpl_select_org
  on public.counterparty_links
  for select
  to authenticated
  using (
    owner_kind = 'organization'
    and exists (
      select 1 from public.organization_members m
      where m.organization_id = counterparty_links.owner_org_id
        and m.user_id = auth.uid()
    )
    and public.has_module_access(auth.uid(), owner_org_id, 'counterparties'::public.app_module)
  );

drop policy if exists cpl_insert_user on public.counterparty_links;
create policy cpl_insert_user
  on public.counterparty_links
  for insert
  to authenticated
  with check (
    owner_kind = 'user'
    and owner_user_id = auth.uid()
    and created_by = auth.uid()
  );

drop policy if exists cpl_insert_org on public.counterparty_links;
create policy cpl_insert_org
  on public.counterparty_links
  for insert
  to authenticated
  with check (
    owner_kind = 'organization'
    and created_by = auth.uid()
    and exists (
      select 1 from public.organization_members m
      where m.organization_id = counterparty_links.owner_org_id
        and m.user_id = auth.uid()
    )
    and public.has_module_access(auth.uid(), owner_org_id, 'counterparties'::public.app_module)
  );

drop policy if exists cpl_delete_user on public.counterparty_links;
create policy cpl_delete_user
  on public.counterparty_links
  for delete
  to authenticated
  using (owner_kind = 'user' and owner_user_id = auth.uid());

drop policy if exists cpl_delete_org on public.counterparty_links;
create policy cpl_delete_org
  on public.counterparty_links
  for delete
  to authenticated
  using (
    owner_kind = 'organization'
    and exists (
      select 1 from public.organization_members m
      where m.organization_id = counterparty_links.owner_org_id
        and m.user_id = auth.uid()
    )
    and public.has_module_access(auth.uid(), owner_org_id, 'counterparties'::public.app_module)
  );

comment on table public.counterparty_links is
  'Linki: właściciel (user lub organizacja) → kontrahent (organizacja z bazy współdzielonej). Etap 1: tylko owner_kind=user.';
