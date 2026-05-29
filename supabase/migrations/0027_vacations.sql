-- 0027_vacations.sql — Urlopy w obrębie organizacji (zakres dat + opcjonalny opis)
create table if not exists public.vacations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  start_date date not null,
  end_date date not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vacations_date_order_chk check (end_date >= start_date)
);

create index if not exists vacations_org_date_idx on public.vacations (organization_id, start_date desc);

grant select, insert, update, delete on public.vacations to authenticated;
grant all on public.vacations to service_role;

alter table public.vacations enable row level security;

drop policy if exists "vacations_select_member_or_admin" on public.vacations;
create policy "vacations_select_member_or_admin" on public.vacations for select to authenticated
  using (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

drop policy if exists "vacations_insert_member_or_admin" on public.vacations;
create policy "vacations_insert_member_or_admin" on public.vacations for insert to authenticated
  with check (created_by = auth.uid() and (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid())));

drop policy if exists "vacations_update_member_or_admin" on public.vacations;
create policy "vacations_update_member_or_admin" on public.vacations for update to authenticated
  using (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()))
  with check (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

drop policy if exists "vacations_delete_owner_or_admin" on public.vacations;
create policy "vacations_delete_owner_or_admin" on public.vacations for delete to authenticated
  using (created_by = auth.uid() or public.is_owner_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

notify pgrst, 'reload schema';
