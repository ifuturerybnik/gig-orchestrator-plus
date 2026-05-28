-- ============================================================================
-- Concertivo — migracja 0019: autokorespondencja (kampanie + wiadomości)
-- ============================================================================
-- Kampania = jednorazowy mailing do listy odbiorców z planowaniem (dni
-- tygodnia, godziny, rate-limit per minuta) i trackingiem (otwarcia,
-- kliknięcia, odbicia, rezygnacje).
--
-- Odbiorcy są wyznaczani filtrami zapisanymi w polu `filtry` (jsonb) — silnik
-- po stronie server fn rozwija filtry do listy emaili (z contacts + counterparties).
--
-- Wiadomości generowane są przez tick (autokor-tick) — patrz route public.
--
-- INSTRUKCJA: Wklej w SQL Editor → Run. Idempotentne.
-- ============================================================================

create table if not exists public.autokorespondencje (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  skrzynka_id uuid not null references public.email_skrzynki(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete set null,

  nazwa text not null,
  status text not null check (status in ('draft', 'scheduled', 'running', 'paused', 'done', 'cancelled')) default 'draft',

  temat text not null default '',
  body_html text not null default '',
  szablon_id uuid references public.email_szablony(id) on delete set null,

  -- filtry odbiorców (JSON) — strukturę interpretuje server fn:
  -- {
  --   "zrodlo": ["user_contacts","org_contacts","org_counterparties"],
  --   "typy": ["person","company","artist"],
  --   "tagi": ["..."],
  --   "kraje": ["PL","DE"],
  --   "miasta": ["Warszawa"],
  --   "gatunki": ["jazz","rock"],
  --   "kontrahenci_ids": ["..."],
  --   "wyklucz_rezygnacje": true,
  --   "wyklucz_odbicia": true
  -- }
  filtry jsonb not null default '{}'::jsonb,

  -- harmonogram
  start_at timestamptz,
  end_at timestamptz,
  godziny_od time not null default '09:00',
  godziny_do time not null default '17:00',
  dni_tygodnia int[] not null default '{1,2,3,4,5}', -- 1=pn ... 7=nd
  rate_per_min integer not null default 10,
  timezone text not null default 'Europe/Warsaw',

  -- stats cache
  total_odbiorcow integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists autokor_org_idx on public.autokorespondencje(organization_id);
create index if not exists autokor_status_idx on public.autokorespondencje(status);

create table if not exists public.autokorespondencje_wiadomosci (
  id uuid primary key default gen_random_uuid(),
  kampania_id uuid not null references public.autokorespondencje(id) on delete cascade,

  recipient_email text not null,
  recipient_name text,
  recipient_kind text check (recipient_kind in ('contact', 'counterparty')),
  recipient_id uuid,

  status text not null check (status in ('pending', 'sent', 'failed', 'skipped', 'bounced', 'unsubscribed')) default 'pending',

  planowana_wysylka timestamptz,
  wyslano_at timestamptz,
  blad_opis text,

  temat_rendered text,
  body_html_rendered text,

  otwarcia integer not null default 0,
  klikniecia integer not null default 0,

  unsubscribe_token text unique,

  created_at timestamptz not null default now()
);

create index if not exists autokor_wiad_kampania_idx on public.autokorespondencje_wiadomosci(kampania_id);
create index if not exists autokor_wiad_status_idx on public.autokorespondencje_wiadomosci(status);
create index if not exists autokor_wiad_planowana_idx on public.autokorespondencje_wiadomosci(planowana_wysylka) where status = 'pending';
create index if not exists autokor_wiad_token_idx on public.autokorespondencje_wiadomosci(unsubscribe_token);

grant select, insert, update, delete on public.autokorespondencje to authenticated;
grant select, insert, update, delete on public.autokorespondencje_wiadomosci to authenticated;
grant all on public.autokorespondencje to service_role;
grant all on public.autokorespondencje_wiadomosci to service_role;

alter table public.autokorespondencje enable row level security;
alter table public.autokorespondencje_wiadomosci enable row level security;

-- ----- Polityki na autokorespondencje -----
drop policy if exists autokor_select on public.autokorespondencje;
create policy autokor_select on public.autokorespondencje for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = autokorespondencje.organization_id and om.user_id = auth.uid()
  )
);

drop policy if exists autokor_insert on public.autokorespondencje;
create policy autokor_insert on public.autokorespondencje for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.organization_members om
    where om.organization_id = autokorespondencje.organization_id and om.user_id = auth.uid()
  )
);

drop policy if exists autokor_update on public.autokorespondencje;
create policy autokor_update on public.autokorespondencje for update to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = autokorespondencje.organization_id and om.user_id = auth.uid()
  )
);

drop policy if exists autokor_delete on public.autokorespondencje;
create policy autokor_delete on public.autokorespondencje for delete to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = autokorespondencje.organization_id and om.user_id = auth.uid() and om.role = 'owner'
  )
);

-- ----- Polityki na autokorespondencje_wiadomosci -----
drop policy if exists autokor_wiad_select on public.autokorespondencje_wiadomosci;
create policy autokor_wiad_select on public.autokorespondencje_wiadomosci for select to authenticated
using (
  exists (
    select 1 from public.autokorespondencje a
    join public.organization_members om on om.organization_id = a.organization_id
    where a.id = autokorespondencje_wiadomosci.kampania_id and om.user_id = auth.uid()
  )
);

-- INSERT/UPDATE/DELETE wykonują server fns przez service_role (cron tick).
-- Pozostawiamy authenticated bez zapisu — zapis tylko przez service_role.
