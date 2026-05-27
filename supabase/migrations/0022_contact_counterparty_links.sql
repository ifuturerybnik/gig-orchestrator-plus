-- 0022_contact_counterparty_links.sql
-- Powiązania kontakt (osoba) ↔ kontrahent (organizacja).
-- Etap 1: tylko owner_kind = 'user'. Polityki org są przygotowane.
-- Uruchom RĘCZNIE w panelu zewnętrznego Supabase (SQL Editor).

create table if not exists public.contact_counterparty_links (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  counterparty_org_id uuid not null references public.organizations(id) on delete cascade,
  owner_kind public.counterparty_owner_kind not null,
  owner_user_id uuid references auth.users(id) on delete cascade,
  owner_org_id  uuid references public.organizations(id) on delete cascade,
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint ccl_owner_xor check (
    (owner_kind = 'user'         and owner_user_id is not null and owner_org_id is null) or
    (owner_kind = 'organization' and owner_org_id  is not null and owner_user_id is null)
  )
);

create unique index if not exists uniq_ccl_user
  on public.contact_counterparty_links (owner_user_id, contact_id, counterparty_org_id)
  where owner_kind = 'user';

create unique index if not exists uniq_ccl_org
  on public.contact_counterparty_links (owner_org_id, contact_id, counterparty_org_id)
  where owner_kind = 'organization';

create index if not exists idx_ccl_contact on public.contact_counterparty_links (contact_id);
create index if not exists idx_ccl_cp on public.contact_counterparty_links (counterparty_org_id);
create index if not exists idx_ccl_user_owner
  on public.contact_counterparty_links (owner_user_id)
  where owner_kind = 'user';

grant select, insert, update, delete on public.contact_counterparty_links to authenticated;
grant all on public.contact_counterparty_links to service_role;

alter table public.contact_counterparty_links enable row level security;

drop policy if exists ccl_select_user on public.contact_counterparty_links;
create policy ccl_select_user on public.contact_counterparty_links
  for select to authenticated
  using (owner_kind = 'user' and owner_user_id = auth.uid());

drop policy if exists ccl_insert_user on public.contact_counterparty_links;
create policy ccl_insert_user on public.contact_counterparty_links
  for insert to authenticated
  with check (
    owner_kind = 'user' and owner_user_id = auth.uid() and created_by = auth.uid()
  );

drop policy if exists ccl_delete_user on public.contact_counterparty_links;
create policy ccl_delete_user on public.contact_counterparty_links
  for delete to authenticated
  using (owner_kind = 'user' and owner_user_id = auth.uid());

drop policy if exists ccl_select_org on public.contact_counterparty_links;
create policy ccl_select_org on public.contact_counterparty_links
  for select to authenticated
  using (
    owner_kind = 'organization'
    and exists (
      select 1 from public.organization_members m
      where m.organization_id = contact_counterparty_links.owner_org_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists ccl_insert_org on public.contact_counterparty_links;
create policy ccl_insert_org on public.contact_counterparty_links
  for insert to authenticated
  with check (
    owner_kind = 'organization' and created_by = auth.uid()
    and exists (
      select 1 from public.organization_members m
      where m.organization_id = contact_counterparty_links.owner_org_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists ccl_delete_org on public.contact_counterparty_links;
create policy ccl_delete_org on public.contact_counterparty_links
  for delete to authenticated
  using (
    owner_kind = 'organization'
    and exists (
      select 1 from public.organization_members m
      where m.organization_id = contact_counterparty_links.owner_org_id
        and m.user_id = auth.uid()
    )
  );

comment on table public.contact_counterparty_links is
  'Powiązania kontakt (osoba) ↔ kontrahent (organizacja). Etap 1: tylko user scope.';
