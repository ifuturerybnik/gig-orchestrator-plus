-- 0020_org_name_normalized.sql
-- Deduplikacja nazw organizacji: kolumna `name_normalized` + trigger + backfill.
-- Uruchom RĘCZNIE w panelu zewnętrznego Supabase (SQL Editor).

create extension if not exists unaccent;
create extension if not exists pg_trgm;

create or replace function public.normalize_org_name(input text)
returns text
language plpgsql
immutable
as $$
declare
  s text;
begin
  if input is null then
    return null;
  end if;
  s := lower(input);
  s := translate(s, 'łŁ', 'lL');
  s := lower(s);
  s := unaccent(s);
  -- formy prawne
  s := regexp_replace(s, '\m(sp(olka)?\.?\s*z\s*o\.?\s*o\.?)\M', ' ', 'gi');
  s := regexp_replace(s, '\m(spolka z ograniczona odpowiedzialnoscia)\M', ' ', 'gi');
  s := regexp_replace(s, '\m(s\.?\s*a\.?|spolka akcyjna)\M', ' ', 'gi');
  s := regexp_replace(s, '\m(sp\.?\s*k\.?|sp\.?\s*j\.?|sp\.?\s*p\.?)\M', ' ', 'gi');
  s := regexp_replace(s, '\m(p\.?\s*p\.?\s*h\.?\s*u\.?|p\.?\s*h\.?\s*u\.?|f\.?\s*h\.?\s*u\.?)\M', ' ', 'gi');
  s := regexp_replace(s, '\m(ltd|llc|inc|gmbh|ag|kft|s\.?r\.?o\.?|s\.?r\.?l\.?|bv|nv|oy|ab|as|plc|corp|co)\M', ' ', 'gi');
  s := regexp_replace(s, '[^a-z0-9 ]+', ' ', 'g');
  s := regexp_replace(s, '\s+', ' ', 'g');
  s := trim(s);
  return s;
end;
$$;

alter table public.organizations
  add column if not exists name_normalized text;

update public.organizations
set name_normalized = public.normalize_org_name(name)
where name_normalized is null;

create or replace function public.tg_organizations_set_name_normalized()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.name is distinct from old.name then
    new.name_normalized := public.normalize_org_name(new.name);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_organizations_name_normalized on public.organizations;
create trigger trg_organizations_name_normalized
  before insert or update of name on public.organizations
  for each row execute function public.tg_organizations_set_name_normalized();

create index if not exists idx_organizations_name_normalized_trgm
  on public.organizations using gin (name_normalized gin_trgm_ops);

create index if not exists idx_organizations_name_normalized
  on public.organizations (name_normalized);

comment on column public.organizations.name_normalized is
  'Znormalizowana nazwa (lower, bez diakrytyków, bez form prawnych, bez interpunkcji). Generowana triggerem.';
