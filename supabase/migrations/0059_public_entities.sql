-- Baza podmiotów publicznych (Baza PP)
-- Jedna tabela dla różnych typów: JST (gminy/powiaty/województwa) + ośrodki kultury,
-- z możliwością dorzucenia kolejnych typów w przyszłości.
-- Dostęp: tylko administratorzy aplikacji (super_admin / admin_staff).

create extension if not exists pg_trgm;

do $$ begin
  create type public.public_entity_type as enum (
    'jst_gmina',
    'jst_powiat',
    'jst_wojewodztwo',
    'osrodek_kultury'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.public_entities (
  id uuid primary key default gen_random_uuid(),
  entity_type public.public_entity_type not null,
  name text not null,
  short_name text,
  teryt_code text,
  jst_type_raw text,
  wojewodztwo text,
  powiat text,
  miejscowosc text,
  kod_pocztowy text,
  poczta text,
  ulica text,
  nr_domu text,
  phone text,
  email text,
  www text,
  epuap_address text,
  edoreczenia_ade text,
  source text,
  source_row_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create unique index if not exists public_entities_teryt_unique
  on public.public_entities (teryt_code)
  where teryt_code is not null;

create index if not exists public_entities_entity_type_idx on public.public_entities (entity_type);
create index if not exists public_entities_wojewodztwo_idx on public.public_entities (wojewodztwo);
create index if not exists public_entities_powiat_idx on public.public_entities (powiat);
create index if not exists public_entities_miejscowosc_idx on public.public_entities (miejscowosc);
create index if not exists public_entities_name_trgm_idx on public.public_entities using gin (name gin_trgm_ops);
create index if not exists public_entities_miejscowosc_trgm_idx on public.public_entities using gin (miejscowosc gin_trgm_ops);

create or replace function public.public_entities_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists public_entities_updated_at on public.public_entities;
create trigger public_entities_updated_at
  before update on public.public_entities
  for each row execute function public.public_entities_set_updated_at();

grant select, insert, update, delete on public.public_entities to authenticated;
grant all on public.public_entities to service_role;

alter table public.public_entities enable row level security;

drop policy if exists public_entities_select_admin on public.public_entities;
create policy public_entities_select_admin
  on public.public_entities for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'admin_staff')
  );

drop policy if exists public_entities_insert_super on public.public_entities;
create policy public_entities_insert_super
  on public.public_entities for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'super_admin'));

drop policy if exists public_entities_update_super on public.public_entities;
create policy public_entities_update_super
  on public.public_entities for update
  to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

drop policy if exists public_entities_delete_super on public.public_entities;
create policy public_entities_delete_super
  on public.public_entities for delete
  to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));
