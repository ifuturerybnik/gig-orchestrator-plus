-- ============================================================================
-- Concertivo — schemat startowy (migracja 0001)
-- ============================================================================
-- INSTRUKCJA URUCHOMIENIA:
-- 1. Otwórz panel zewnętrznego Supabase → SQL Editor → New query
-- 2. Wklej CAŁY ten plik
-- 3. Kliknij Run
-- 4. Po pierwszej rejestracji w aplikacji uruchom polecenie z sekcji
--    "BOOTSTRAP SUPER ADMIN" na końcu pliku (zamień email na swój).
--
-- Plik jest IDEMPOTENTNY (można uruchamiać wielokrotnie bezpiecznie).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------

do $$ begin
  create type public.app_role as enum ('super_admin', 'admin_staff', 'user');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_kind as enum (
    'team_manager',
    'musician',
    'sound_engineer',
    'lighting_engineer',
    'visual_engineer',
    'driver',
    'stage_technician',
    'stage_company_owner',
    'event_company_owner',
    'concert_organizer'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.organization_type as enum ('band', 'stage_company', 'event_company');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.organization_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.member_role as enum ('owner', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invitation_status as enum ('pending', 'accepted', 'expired', 'cancelled');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  preferred_language text default 'pl',
  user_kinds public.user_kind[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  type public.organization_type not null,
  name text not null,
  description text,
  status public.organization_status not null default 'pending',
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizations_status_idx on public.organizations (status);
create index if not exists organizations_created_by_idx on public.organizations (created_by);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists organization_members_user_idx on public.organization_members (user_id);

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id) on delete restrict,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invitations_org_idx on public.organization_invitations (organization_id);
create index if not exists invitations_email_idx on public.organization_invitations (lower(email));

-- ----------------------------------------------------------------------------
-- SECURITY DEFINER FUNCTIONS (avoid RLS recursion)
-- ----------------------------------------------------------------------------

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('super_admin', 'admin_staff')
  );
$$;

create or replace function public.is_member_of(_user_id uuid, _org_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where user_id = _user_id and organization_id = _org_id
  );
$$;

create or replace function public.is_owner_of(_user_id uuid, _org_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where user_id = _user_id and organization_id = _org_id and role = 'owner'
  );
$$;

-- ----------------------------------------------------------------------------
-- TRIGGERS
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, phone, user_kinds, preferred_language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    new.raw_user_meta_data ->> 'phone',
    coalesce(
      (select array_agg(elem::public.user_kind)
       from jsonb_array_elements_text(coalesce(new.raw_user_meta_data -> 'user_kinds', '[]'::jsonb)) elem),
      '{}'::public.user_kind[]
    ),
    coalesce(new.raw_user_meta_data ->> 'preferred_language', 'pl')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_new_organization()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (organization_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_organization_created on public.organizations;
create trigger on_organization_created
  after insert on public.organizations
  for each row execute function public.handle_new_organization();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists organizations_updated_at on public.organizations;
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;

-- profiles
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- user_roles
drop policy if exists "user_roles_select_self_or_admin" on public.user_roles;
create policy "user_roles_select_self_or_admin" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "user_roles_manage_super_admin" on public.user_roles;
create policy "user_roles_manage_super_admin" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- organizations
drop policy if exists "orgs_select_member_or_admin" on public.organizations;
create policy "orgs_select_member_or_admin" on public.organizations
  for select to authenticated
  using (
    public.is_member_of(auth.uid(), id)
    or public.is_admin(auth.uid())
    or created_by = auth.uid()
  );

drop policy if exists "orgs_insert_own" on public.organizations;
create policy "orgs_insert_own" on public.organizations
  for insert to authenticated
  with check (created_by = auth.uid() and status = 'pending');

drop policy if exists "orgs_update_owner_or_admin" on public.organizations;
create policy "orgs_update_owner_or_admin" on public.organizations
  for update to authenticated
  using (public.is_owner_of(auth.uid(), id) or public.is_admin(auth.uid()))
  with check (public.is_owner_of(auth.uid(), id) or public.is_admin(auth.uid()));

-- organization_members
drop policy if exists "members_select_member_or_admin" on public.organization_members;
create policy "members_select_member_or_admin" on public.organization_members
  for select to authenticated
  using (
    public.is_member_of(auth.uid(), organization_id)
    or public.is_admin(auth.uid())
  );

drop policy if exists "members_insert_owner_or_admin" on public.organization_members;
create policy "members_insert_owner_or_admin" on public.organization_members
  for insert to authenticated
  with check (
    public.is_owner_of(auth.uid(), organization_id)
    or public.is_admin(auth.uid())
  );

drop policy if exists "members_delete_owner_or_admin" on public.organization_members;
create policy "members_delete_owner_or_admin" on public.organization_members
  for delete to authenticated
  using (
    public.is_owner_of(auth.uid(), organization_id)
    or public.is_admin(auth.uid())
  );

-- organization_invitations
drop policy if exists "invites_select_org_or_admin" on public.organization_invitations;
create policy "invites_select_org_or_admin" on public.organization_invitations
  for select to authenticated
  using (
    public.is_owner_of(auth.uid(), organization_id)
    or public.is_admin(auth.uid())
  );

drop policy if exists "invites_insert_owner_or_admin" on public.organization_invitations;
create policy "invites_insert_owner_or_admin" on public.organization_invitations
  for insert to authenticated
  with check (
    invited_by = auth.uid()
    and (public.is_owner_of(auth.uid(), organization_id) or public.is_admin(auth.uid()))
  );

drop policy if exists "invites_update_owner_or_admin" on public.organization_invitations;
create policy "invites_update_owner_or_admin" on public.organization_invitations
  for update to authenticated
  using (
    public.is_owner_of(auth.uid(), organization_id)
    or public.is_admin(auth.uid())
  );

-- ----------------------------------------------------------------------------
-- BOOTSTRAP SUPER ADMIN
-- ----------------------------------------------------------------------------
-- Po pierwszej rejestracji w aplikacji uruchom poniższe (zamień email na swój):
--
-- insert into public.user_roles (user_id, role)
-- select id, 'super_admin' from auth.users where email = 'twoj@email.com'
-- on conflict (user_id, role) do nothing;
