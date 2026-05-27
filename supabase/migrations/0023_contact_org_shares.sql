-- 0023_contact_org_shares.sql
-- Pozwala udostępnić prywatny kontakt (owner_user_id) wybranym organizacjom usera.
-- Złoty rekord pozostaje jeden (tabela `contacts`), tabela `contact_org_shares`
-- jest jedynie warstwą widoczności.

create table if not exists public.contact_org_shares (
  id              uuid primary key default gen_random_uuid(),
  contact_id      uuid not null references public.contacts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by      uuid not null references auth.users(id),
  created_at      timestamptz not null default now(),
  unique (contact_id, organization_id)
);

create index if not exists idx_contact_org_shares_contact on public.contact_org_shares (contact_id);
create index if not exists idx_contact_org_shares_org     on public.contact_org_shares (organization_id);

-- Granty (Data API)
grant select, insert, delete on public.contact_org_shares to authenticated;
grant all on public.contact_org_shares to service_role;

-- RLS
alter table public.contact_org_shares enable row level security;

drop policy if exists cos_select on public.contact_org_shares;
create policy cos_select
  on public.contact_org_shares
  for select
  to authenticated
  using (
    exists (
      select 1 from public.contacts c
      where c.id = contact_id and c.owner_user_id = auth.uid()
    )
    or exists (
      select 1 from public.organization_members m
      where m.organization_id = contact_org_shares.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists cos_insert on public.contact_org_shares;
create policy cos_insert
  on public.contact_org_shares
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.contacts c
      where c.id = contact_id and c.owner_user_id = auth.uid()
    )
    and exists (
      select 1 from public.organization_members m
      where m.organization_id = contact_org_shares.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists cos_delete on public.contact_org_shares;
create policy cos_delete
  on public.contact_org_shares
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.contacts c
      where c.id = contact_id and c.owner_user_id = auth.uid()
    )
  );

comment on table public.contact_org_shares is
  'Udostępnienia prywatnych kontaktów (owner_user_id) wybranym organizacjom usera. Złoty rekord pozostaje w public.contacts.';
