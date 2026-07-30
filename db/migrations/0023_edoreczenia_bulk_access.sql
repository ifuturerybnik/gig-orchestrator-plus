create table if not exists public.edoreczenia_bulk_access (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  granted_by uuid,
  granted_at timestamptz not null default now()
);
grant select on public.edoreczenia_bulk_access to authenticated;
grant all on public.edoreczenia_bulk_access to service_role;
alter table public.edoreczenia_bulk_access enable row level security;
do $$ begin
  create policy "members read bulk access" on public.edoreczenia_bulk_access
  for select to authenticated using (
    exists (select 1 from public.organization_members m
            where m.organization_id = edoreczenia_bulk_access.organization_id
              and m.user_id = auth.uid())
  );
exception when duplicate_object then null; end $$;
