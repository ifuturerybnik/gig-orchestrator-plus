-- 0017_org_types_v2.sql
-- Zastępuje pojedyncze `organizations.type` (enum) listą `types text[]`.
-- Dodaje `artist_kind` (rodzaj artysty), `address_building_no` (numer budynku)
-- oraz `is_shared` (przygotowanie pod Turę B — kontrahenci dzieleni między userami).
--
-- Uruchom RĘCZNIE w panelu zewnętrznego Supabase (SQL editor).

-- 1. Nowe kolumny
alter table public.organizations
  add column if not exists types text[] not null default '{}',
  add column if not exists artist_kind text,
  add column if not exists address_building_no text,
  add column if not exists is_shared boolean not null default false;

-- 2. Backfill z istniejącego `type`
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizations'
      and column_name = 'type'
  ) then
    update public.organizations
    set types = case
      when type::text = 'band' then array['artist']
      when type::text = 'stage_company' then array['stage_rental']
      when type::text = 'event_company' then array['event_company']
      else array[]::text[]
    end
    where coalesce(array_length(types, 1), 0) = 0;

    update public.organizations
    set artist_kind = 'band'
    where type::text = 'band' and artist_kind is null;
  end if;
end $$;

-- 3. Usunięcie starej kolumny `type` (jeśli istnieje)
alter table public.organizations drop column if exists type;

-- 4. Drop enum jeśli już nieużywany
do $$
begin
  if exists (select 1 from pg_type where typname = 'organization_type') then
    drop type if exists public.organization_type;
  end if;
exception when others then null;
end $$;

-- 5. Indeksy
create index if not exists idx_organizations_types_gin
  on public.organizations using gin (types);
create index if not exists idx_organizations_is_shared
  on public.organizations (is_shared);

comment on column public.organizations.types is
  'Lista typów organizacji (artist, event_company, event_organizer, stage_rental, lighting_rental, sound_rental, led_rental, pyro, transport).';
comment on column public.organizations.artist_kind is
  'Rodzaj artysty/zespołu (band, solo, cabaret, standup, dj, orchestra, choir, dance, fire_show, illusionist, kids_show, host, other). Tylko gdy artist w types.';
comment on column public.organizations.address_building_no is
  'Numer budynku / lokalu — uzupełnienie do address_street.';
comment on column public.organizations.is_shared is
  'TRUE = wpis kontrahenta widoczny dla wielu userów (dedup po NIP/nazwie). Tura B.';
