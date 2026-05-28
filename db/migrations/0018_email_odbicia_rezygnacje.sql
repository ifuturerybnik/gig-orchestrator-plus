-- ============================================================================
-- Concertivo — migracja 0018: bounce list + lista rezygnacji (suppressions)
-- ============================================================================
-- email_odbicia: lista adresów, które odbiły wiadomość (hard/soft bounce).
-- email_rezygnacje: lista adresów, które wypisały się z autokorespondencji.
-- Obie tabele są scoped per organization (każda org ma własną listę).
--
-- INSTRUKCJA: Wklej w SQL Editor → Run. Idempotentne.
-- ============================================================================

create table if not exists public.email_odbicia (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  email text not null,
  typ text not null check (typ in ('hard', 'soft', 'complaint')) default 'hard',
  powod text,
  zgloszone_at timestamptz not null default now(),
  unique (organization_id, email, typ)
);

create index if not exists email_odbicia_email_idx on public.email_odbicia(email);
create index if not exists email_odbicia_org_idx on public.email_odbicia(organization_id);

create table if not exists public.email_rezygnacje (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  email text not null,
  kampania_id uuid,
  zgloszone_at timestamptz not null default now(),
  unique (organization_id, email)
);

create index if not exists email_rezygnacje_email_idx on public.email_rezygnacje(email);
create index if not exists email_rezygnacje_org_idx on public.email_rezygnacje(organization_id);

grant select, delete on public.email_odbicia to authenticated;
grant select, delete on public.email_rezygnacje to authenticated;
grant all on public.email_odbicia to service_role;
grant all on public.email_rezygnacje to service_role;

alter table public.email_odbicia enable row level security;
alter table public.email_rezygnacje enable row level security;

-- SELECT: członkowie organizacji
drop policy if exists email_odbicia_select on public.email_odbicia;
create policy email_odbicia_select on public.email_odbicia for select to authenticated
using (
  organization_id is null
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = email_odbicia.organization_id and om.user_id = auth.uid()
  )
);

drop policy if exists email_odbicia_delete on public.email_odbicia;
create policy email_odbicia_delete on public.email_odbicia for delete to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = email_odbicia.organization_id and om.user_id = auth.uid() and om.role = 'owner'
  )
);

drop policy if exists email_rezygnacje_select on public.email_rezygnacje;
create policy email_rezygnacje_select on public.email_rezygnacje for select to authenticated
using (
  organization_id is null
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = email_rezygnacje.organization_id and om.user_id = auth.uid()
  )
);

drop policy if exists email_rezygnacje_delete on public.email_rezygnacje;
create policy email_rezygnacje_delete on public.email_rezygnacje for delete to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = email_rezygnacje.organization_id and om.user_id = auth.uid() and om.role = 'owner'
  )
);
