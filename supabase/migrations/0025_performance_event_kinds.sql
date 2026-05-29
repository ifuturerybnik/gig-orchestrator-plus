-- Add event kind + notes to performances, and org-scoped custom kinds dictionary.

alter table public.performances
  add column if not exists event_kind text,
  add column if not exists notes text;

update public.performances set event_kind = 'concert' where event_kind is null;

alter table public.performances
  alter column event_kind set not null;

create table if not exists public.performance_event_kinds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, label)
);

create index if not exists performance_event_kinds_org_idx
  on public.performance_event_kinds(organization_id);

grant select, insert, update, delete on public.performance_event_kinds to authenticated;
grant all on public.performance_event_kinds to service_role;

alter table public.performance_event_kinds enable row level security;

drop policy if exists "perf_kinds_select" on public.performance_event_kinds;
create policy "perf_kinds_select" on public.performance_event_kinds for select to authenticated
  using (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

drop policy if exists "perf_kinds_insert" on public.performance_event_kinds;
create policy "perf_kinds_insert" on public.performance_event_kinds for insert to authenticated
  with check (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

drop policy if exists "perf_kinds_update" on public.performance_event_kinds;
create policy "perf_kinds_update" on public.performance_event_kinds for update to authenticated
  using (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()))
  with check (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

drop policy if exists "perf_kinds_delete" on public.performance_event_kinds;
create policy "perf_kinds_delete" on public.performance_event_kinds for delete to authenticated
  using (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

notify pgrst, 'reload schema';
