-- ============================================================================
-- Concertivo — migracja 0017: tracking linków i otwarć
-- ============================================================================
-- Każdy link w wysłanej wiadomości jest opakowany w token redirect, każdy
-- otwarcie raportuje pixel 1x1. Używane w Poczcie (opcjonalne) i Autokor.
--
-- INSTRUKCJA: Wklej w SQL Editor → Run. Idempotentne.
-- ============================================================================

create table if not exists public.email_linki_sledzace (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  -- powiązanie z wysłaną wiadomością (kampania) — opcjonalne (compose też może trackować)
  kampania_id uuid,
  kampania_wiadomosc_id uuid,
  skrzynka_id uuid references public.email_skrzynki(id) on delete cascade,
  recipient_email text,

  url_docelowy text not null,
  label text,

  klikniecia integer not null default 0,
  ostatnie_klikniecie_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_linki_token_idx on public.email_linki_sledzace(token);
create index if not exists email_linki_kampania_idx on public.email_linki_sledzace(kampania_id);
create index if not exists email_linki_wiadomosc_idx on public.email_linki_sledzace(kampania_wiadomosc_id);

create table if not exists public.email_linki_klikniecia (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.email_linki_sledzace(id) on delete cascade,
  klikniety_at timestamptz not null default now(),
  ip text,
  user_agent text
);

create index if not exists email_linki_klikniecia_link_idx on public.email_linki_klikniecia(link_id);

create table if not exists public.email_otwarcia (
  id uuid primary key default gen_random_uuid(),
  kampania_id uuid,
  kampania_wiadomosc_id uuid,
  recipient_email text,
  otwarte_at timestamptz not null default now(),
  ip text,
  user_agent text
);

create index if not exists email_otwarcia_kampania_idx on public.email_otwarcia(kampania_id);
create index if not exists email_otwarcia_wiadomosc_idx on public.email_otwarcia(kampania_wiadomosc_id);

grant select on public.email_linki_sledzace to authenticated;
grant select on public.email_linki_klikniecia to authenticated;
grant select on public.email_otwarcia to authenticated;
grant all on public.email_linki_sledzace to service_role;
grant all on public.email_linki_klikniecia to service_role;
grant all on public.email_otwarcia to service_role;

alter table public.email_linki_sledzace enable row level security;
alter table public.email_linki_klikniecia enable row level security;
alter table public.email_otwarcia enable row level security;

-- SELECT dla zalogowanych — zapis tylko przez service_role (server fn).
drop policy if exists email_linki_select on public.email_linki_sledzace;
create policy email_linki_select on public.email_linki_sledzace for select to authenticated using (true);

drop policy if exists email_klik_select on public.email_linki_klikniecia;
create policy email_klik_select on public.email_linki_klikniecia for select to authenticated using (true);

drop policy if exists email_otw_select on public.email_otwarcia;
create policy email_otw_select on public.email_otwarcia for select to authenticated using (true);
