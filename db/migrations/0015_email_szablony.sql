-- ============================================================================
-- Concertivo — migracja 0015: szablony wiadomości email
-- ============================================================================
-- Szablony używane w Poczcie (Compose) oraz w Autokorespondencji.
-- Scope: per user (osobisty) lub per organization (wspólny).
-- Body w formacie HTML (z Tiptap), pola dynamiczne typu {{kontakt.imie}}.
--
-- INSTRUKCJA: Wklej w SQL Editor zewnętrznego Supabase Concertivo → Run.
-- Plik jest IDEMPOTENTNY.
-- ============================================================================

create table if not exists public.email_szablony (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('user', 'organization')),
  owner_user_id uuid references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,

  nazwa text not null,
  kategoria text,
  temat text not null default '',
  body_html text not null default '',
  body_text text,

  zmienne jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint email_szablony_scope_owner check (
    (scope = 'user' and owner_user_id is not null and organization_id is null)
    or (scope = 'organization' and organization_id is not null and owner_user_id is null)
  )
);

create index if not exists email_szablony_owner_idx on public.email_szablony(owner_user_id) where scope = 'user';
create index if not exists email_szablony_org_idx on public.email_szablony(organization_id) where scope = 'organization';

grant select, insert, update, delete on public.email_szablony to authenticated;
grant all on public.email_szablony to service_role;

alter table public.email_szablony enable row level security;

drop policy if exists email_szablony_select on public.email_szablony;
create policy email_szablony_select on public.email_szablony for select to authenticated
using (
  (scope = 'user' and owner_user_id = auth.uid())
  or (scope = 'organization' and exists (
    select 1 from public.organization_members om
    where om.organization_id = email_szablony.organization_id and om.user_id = auth.uid()
  ))
);

drop policy if exists email_szablony_insert on public.email_szablony;
create policy email_szablony_insert on public.email_szablony for insert to authenticated
with check (
  (scope = 'user' and owner_user_id = auth.uid())
  or (scope = 'organization' and exists (
    select 1 from public.organization_members om
    where om.organization_id = email_szablony.organization_id and om.user_id = auth.uid()
  ))
);

drop policy if exists email_szablony_update on public.email_szablony;
create policy email_szablony_update on public.email_szablony for update to authenticated
using (
  (scope = 'user' and owner_user_id = auth.uid())
  or (scope = 'organization' and exists (
    select 1 from public.organization_members om
    where om.organization_id = email_szablony.organization_id and om.user_id = auth.uid()
  ))
);

drop policy if exists email_szablony_delete on public.email_szablony;
create policy email_szablony_delete on public.email_szablony for delete to authenticated
using (
  (scope = 'user' and owner_user_id = auth.uid())
  or (scope = 'organization' and exists (
    select 1 from public.organization_members om
    where om.organization_id = email_szablony.organization_id and om.user_id = auth.uid() and om.role = 'owner'
  ))
);
