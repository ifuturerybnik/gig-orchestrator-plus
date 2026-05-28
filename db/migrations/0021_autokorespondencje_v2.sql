-- ============================================================================
-- Concertivo — migracja 0021: autokorespondencja v2 (warianty, tracking,
-- limity, dedup, globalna lista wypisanych). Port modułu z CRM Hub.
--
-- WAŻNE: idempotentna — można uruchamiać wielokrotnie.
-- Po wklejeniu w SQL Editor zewnętrznego Supabase → Run. Nie wymaga
-- nowych sekretów, nowych cronów ani innych ręcznych kroków.
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 1) ROZBUDOWA: autokorespondencje (kampanie)
-- ──────────────────────────────────────────────────────────────────────────────
alter table public.autokorespondencje
  add column if not exists opis text,
  add column if not exists audience text not null default 'contacts',
  add column if not exists sender_config jsonb not null default '{}'::jsonb,
  add column if not exists schedule jsonb not null default '{}'::jsonb,
  add column if not exists dodaj_stopke_unsubscribe boolean not null default true,
  add column if not exists open_tracking boolean not null default true,
  add column if not exists dolacz_stopke_email boolean not null default true,
  add column if not exists dzienny_limit integer,
  add column if not exists dzienny_limit_per_skrzynka integer not null default 200,
  add column if not exists auto_pause_after_failures integer not null default 5,
  add column if not exists auto_paused_reason text;

-- audience: 'contacts' | 'counterparties' | 'manualne' (CRM Hub używa 'leady'/'klienci'/'manualne')
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'autokorespondencje_audience_chk'
      and table_name = 'autokorespondencje'
  ) then
    alter table public.autokorespondencje
      add constraint autokorespondencje_audience_chk
      check (audience in ('contacts','counterparties','manualne'));
  end if;
end$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2) ROZBUDOWA: autokorespondencje_wiadomosci
-- ──────────────────────────────────────────────────────────────────────────────
alter table public.autokorespondencje_wiadomosci
  add column if not exists wariant_id uuid,
  add column if not exists otwarcia_count integer not null default 0,
  add column if not exists klikniecia_count integer not null default 0,
  add column if not exists pierwsze_otwarcie timestamptz,
  add column if not exists pierwsze_klikniecie timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- alias kolumny `wyslano_at` → `sent_at` (CRM Hub używa sent_at). Bez zmiany
-- nazwy — silnik aktualizuje obie kolumny dla wstecznej zgodności.

-- trigger touchujący updated_at
create or replace function public.touch_autokor_wiadomosc_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists trg_autokor_wiad_touch on public.autokorespondencje_wiadomosci;
create trigger trg_autokor_wiad_touch
  before update on public.autokorespondencje_wiadomosci
  for each row execute function public.touch_autokor_wiadomosc_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- 3) NOWA TABELA: autokorespondencje_warianty (A/B + rotacje)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.autokorespondencje_warianty (
  id uuid primary key default gen_random_uuid(),
  kampania_id uuid not null references public.autokorespondencje(id) on delete cascade,
  nazwa text not null default 'Wariant 1',
  pozycja integer not null default 0,
  filters jsonb not null default '{}'::jsonb,
  temat text not null default '',
  body_html text not null default '',
  rotacje_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists autokor_warianty_kampania_idx on public.autokorespondencje_warianty(kampania_id);

-- FK z wiadomosci.wariant_id → warianty.id (set null on delete)
do $$
begin
  if not exists (
    select 1 from information_schema.referential_constraints
    where constraint_name = 'autokor_wiad_wariant_fk'
  ) then
    alter table public.autokorespondencje_wiadomosci
      add constraint autokor_wiad_wariant_fk
      foreign key (wariant_id) references public.autokorespondencje_warianty(id) on delete set null;
  end if;
end$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4) NOWA TABELA: autokorespondencje_klikniecia (log kliknięć)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.autokorespondencje_klikniecia (
  id uuid primary key default gen_random_uuid(),
  wiadomosc_id uuid not null references public.autokorespondencje_wiadomosci(id) on delete cascade,
  link_id text,
  url text,
  user_agent text,
  ip text,
  referer text,
  created_at timestamptz not null default now()
);
create index if not exists autokor_klik_wiad_idx on public.autokorespondencje_klikniecia(wiadomosc_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 5) NOWA TABELA: autokorespondencje_otwarcia (log otwarć)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.autokorespondencje_otwarcia (
  id uuid primary key default gen_random_uuid(),
  wiadomosc_id uuid not null references public.autokorespondencje_wiadomosci(id) on delete cascade,
  user_agent text,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists autokor_otw_wiad_idx on public.autokorespondencje_otwarcia(wiadomosc_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 6) NOWA TABELA: autokorespondencje_wypisani (globalna lista wypisanych)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.autokorespondencje_wypisani (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_norm text generated always as (lower(email)) stored unique,
  organization_id uuid references public.organizations(id) on delete set null,
  kampania_id uuid references public.autokorespondencje(id) on delete set null,
  reason text not null default 'one-click',
  created_at timestamptz not null default now()
);
create index if not exists autokor_wypisani_email_idx on public.autokorespondencje_wypisani(email_norm);
create index if not exists autokor_wypisani_org_idx on public.autokorespondencje_wypisani(organization_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 7) CONTACTS: flaga "nie wysyłaj autokorespondencji" (jeśli tabela istnieje)
--     Bezpiecznie — DO block, nie błąd jeśli contacts jeszcze nie ma.
-- ──────────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'contacts'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'contacts'
        and column_name = 'nie_wysylaj_autokorespondencji'
    ) then
      execute 'alter table public.contacts add column nie_wysylaj_autokorespondencji boolean not null default false';
    end if;
  end if;
end$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 8) GRANTS + RLS
-- ──────────────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.autokorespondencje_warianty to authenticated;
grant all on public.autokorespondencje_warianty to service_role;

grant select on public.autokorespondencje_klikniecia to authenticated;
grant all on public.autokorespondencje_klikniecia to service_role;

grant select on public.autokorespondencje_otwarcia to authenticated;
grant all on public.autokorespondencje_otwarcia to service_role;

grant select, delete on public.autokorespondencje_wypisani to authenticated;
grant all on public.autokorespondencje_wypisani to service_role;

alter table public.autokorespondencje_warianty enable row level security;
alter table public.autokorespondencje_klikniecia enable row level security;
alter table public.autokorespondencje_otwarcia enable row level security;
alter table public.autokorespondencje_wypisani enable row level security;

-- warianty: członkowie org kampanii
drop policy if exists autokor_war_select on public.autokorespondencje_warianty;
create policy autokor_war_select on public.autokorespondencje_warianty for select to authenticated
using (
  exists (
    select 1 from public.autokorespondencje a
    join public.organization_members om on om.organization_id = a.organization_id
    where a.id = autokorespondencje_warianty.kampania_id and om.user_id = auth.uid()
  )
);

drop policy if exists autokor_war_modify on public.autokorespondencje_warianty;
create policy autokor_war_modify on public.autokorespondencje_warianty for all to authenticated
using (
  exists (
    select 1 from public.autokorespondencje a
    join public.organization_members om on om.organization_id = a.organization_id
    where a.id = autokorespondencje_warianty.kampania_id and om.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.autokorespondencje a
    join public.organization_members om on om.organization_id = a.organization_id
    where a.id = autokorespondencje_warianty.kampania_id and om.user_id = auth.uid()
  )
);

-- kliknięcia/otwarcia: SELECT dla członków org. Zapis tylko przez service_role.
drop policy if exists autokor_klik_select on public.autokorespondencje_klikniecia;
create policy autokor_klik_select on public.autokorespondencje_klikniecia for select to authenticated
using (
  exists (
    select 1 from public.autokorespondencje_wiadomosci m
    join public.autokorespondencje a on a.id = m.kampania_id
    join public.organization_members om on om.organization_id = a.organization_id
    where m.id = autokorespondencje_klikniecia.wiadomosc_id and om.user_id = auth.uid()
  )
);

drop policy if exists autokor_otw_select on public.autokorespondencje_otwarcia;
create policy autokor_otw_select on public.autokorespondencje_otwarcia for select to authenticated
using (
  exists (
    select 1 from public.autokorespondencje_wiadomosci m
    join public.autokorespondencje a on a.id = m.kampania_id
    join public.organization_members om on om.organization_id = a.organization_id
    where m.id = autokorespondencje_otwarcia.wiadomosc_id and om.user_id = auth.uid()
  )
);

-- wypisani: SELECT/DELETE dla członków org (po organization_id albo dla wszystkich
-- gdy org=null bo unsubscribe one-click nie wie do której org należał).
drop policy if exists autokor_wyp_select on public.autokorespondencje_wypisani;
create policy autokor_wyp_select on public.autokorespondencje_wypisani for select to authenticated
using (
  organization_id is null
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = autokorespondencje_wypisani.organization_id
      and om.user_id = auth.uid()
  )
);

drop policy if exists autokor_wyp_delete on public.autokorespondencje_wypisani;
create policy autokor_wyp_delete on public.autokorespondencje_wypisani for delete to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = autokorespondencje_wypisani.organization_id
      and om.user_id = auth.uid()
  )
);

-- ============================================================================
-- KONIEC migracji 0021.
-- ============================================================================
