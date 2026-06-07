-- 0051_org_change_requests.sql
-- Wnioski o zmianę nazwy / opisu / gatunku organizacji wymagające
-- zatwierdzenia przez administratora aplikacji.
--
-- URUCHOM RĘCZNIE w panelu zewnętrznego Supabase (SQL editor).

create table if not exists public.organization_change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  genres text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists org_change_requests_org_idx
  on public.organization_change_requests (organization_id, status);
create index if not exists org_change_requests_status_idx
  on public.organization_change_requests (status, created_at);

create unique index if not exists org_change_requests_unique_pending
  on public.organization_change_requests (organization_id)
  where status = 'pending';

grant select, insert, update on public.organization_change_requests to authenticated;
grant all on public.organization_change_requests to service_role;

alter table public.organization_change_requests enable row level security;

drop policy if exists "ocr_select_members_or_admin"
  on public.organization_change_requests;
create policy "ocr_select_members_or_admin"
  on public.organization_change_requests
  for select to authenticated
  using (
    public.is_member_of(auth.uid(), organization_id)
    or public.is_admin(auth.uid())
  );

drop policy if exists "ocr_insert_members"
  on public.organization_change_requests;
create policy "ocr_insert_members"
  on public.organization_change_requests
  for insert to authenticated
  with check (
    requested_by = auth.uid()
    and (
      public.is_member_of(auth.uid(), organization_id)
      or public.is_admin(auth.uid())
    )
  );

drop policy if exists "ocr_update_admin_or_requester"
  on public.organization_change_requests;
create policy "ocr_update_admin_or_requester"
  on public.organization_change_requests
  for update to authenticated
  using (
    public.is_admin(auth.uid())
    or (requested_by = auth.uid() and status = 'pending')
  );
