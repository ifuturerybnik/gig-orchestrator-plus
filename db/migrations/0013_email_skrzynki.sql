-- ============================================================================
-- Concertivo — migracja 0013: skrzynki pocztowe (email_skrzynki)
-- ============================================================================
-- Tabela trzymana w bazie Concertivo. Mail-proxy (mail.concertivo.eu) czyta
-- z niej dane SMTP/IMAP per użytkownik/organizacja i wysyła/synchronizuje
-- pocztę w ich imieniu.
--
-- Hasła SMTP/IMAP są szyfrowane symetrycznie po stronie proxy
-- (MAIL_ENCRYPTION_KEY w .env proxy) — w bazie leżą jako bytea.
-- NIGDY nie wstawiaj haseł plaintextem do tej tabeli z aplikacji — zawsze
-- przez server function która woła endpoint proxy /encrypt (lub szyfruje
-- tym samym kluczem).
--
-- INSTRUKCJA: Wklej w SQL Editor zewnętrznego Supabase Concertivo → Run.
-- Plik jest IDEMPOTENTNY.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUM: typ skrzynki
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.email_skrzynka_typ as enum ('osobista', 'wspolna');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- TABELA: email_skrzynki
-- ----------------------------------------------------------------------------
create table if not exists public.email_skrzynki (
  id uuid primary key default gen_random_uuid(),
  nazwa text not null,
  typ public.email_skrzynka_typ not null,

  -- osobista: właściciel = user; wspolna: przypisana do organizacji
  owner_user_id uuid references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,

  email text not null,

  imap_host text not null,
  imap_port integer not null default 993,
  imap_login text not null,
  imap_haslo_encrypted bytea not null,
  imap_use_ssl boolean not null default true,

  smtp_host text not null,
  smtp_port integer not null default 465,
  smtp_login text not null,
  smtp_haslo_encrypted bytea not null,
  smtp_use_ssl boolean not null default true,

  aktywna boolean not null default true,
  last_sync_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint osobista_wymaga_usera check (
    (typ = 'osobista' and owner_user_id is not null and organization_id is null) or
    (typ = 'wspolna'  and organization_id is not null and owner_user_id is null)
  )
);

create index if not exists idx_email_skrzynki_owner on public.email_skrzynki(owner_user_id);
create index if not exists idx_email_skrzynki_org   on public.email_skrzynki(organization_id);
create index if not exists idx_email_skrzynki_typ   on public.email_skrzynki(typ);

-- ----------------------------------------------------------------------------
-- TABELA: dostęp do skrzynek wspólnych (członkowie organizacji)
-- ----------------------------------------------------------------------------
-- Domyślnie wszyscy członkowie organizacji mają dostęp do jej skrzynek
-- wspólnych (decyzja w polityce RLS poniżej). Ta tabela istnieje na wypadek
-- gdybyśmy chcieli w przyszłości ograniczać dostęp punktowo — na razie
-- zostaje pusta i nie jest wymagana.
create table if not exists public.email_skrzynki_dostep (
  id uuid primary key default gen_random_uuid(),
  skrzynka_id uuid not null references public.email_skrzynki(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (skrzynka_id, user_id)
);

create index if not exists idx_email_dostep_user on public.email_skrzynki_dostep(user_id);
create index if not exists idx_email_dostep_skrzynka on public.email_skrzynki_dostep(skrzynka_id);

-- ----------------------------------------------------------------------------
-- HELPER: czy aktualny user ma dostęp do danej skrzynki?
-- ----------------------------------------------------------------------------
create or replace function public.has_email_skrzynka_access(_skrzynka_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.email_skrzynki s
    where s.id = _skrzynka_id
      and (
        -- osobista — właściciel
        s.owner_user_id = auth.uid()
        -- wspolna — członek organizacji
        or exists (
          select 1 from public.organization_members om
          where om.organization_id = s.organization_id
            and om.user_id = auth.uid()
        )
        -- punktowy wyjątek (na przyszłość)
        or exists (
          select 1 from public.email_skrzynki_dostep d
          where d.skrzynka_id = s.id
            and d.user_id = auth.uid()
        )
      )
  );
$$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.email_skrzynki enable row level security;
alter table public.email_skrzynki_dostep enable row level security;

-- SELECT: użytkownik widzi tylko skrzynki, do których ma dostęp.
-- UWAGA: kolumny *_haslo_encrypted MUSZĄ być wykluczane na poziomie zapytań
-- aplikacji (klient nigdy nie powinien czytać haseł — to robi proxy
-- service_role'em). Server fn po stronie aplikacji ZAWSZE wybiera tylko
-- bezpieczne kolumny.
drop policy if exists "select_own_skrzynki" on public.email_skrzynki;
create policy "select_own_skrzynki"
  on public.email_skrzynki for select
  to authenticated
  using (public.has_email_skrzynka_access(id));

-- INSERT/UPDATE/DELETE: tylko przez server fn (service_role bypassuje RLS).
-- Klient nie modyfikuje tej tabeli bezpośrednio — zawsze przez API
-- (bo trzeba zaszyfrować hasła).
drop policy if exists "no_client_writes_skrzynki" on public.email_skrzynki;
create policy "no_client_writes_skrzynki"
  on public.email_skrzynki for all
  to authenticated
  using (false)
  with check (false);

-- Tabela dostępu — tylko odczyt swoich wpisów, zapis przez service_role.
drop policy if exists "select_own_dostep" on public.email_skrzynki_dostep;
create policy "select_own_dostep"
  on public.email_skrzynki_dostep for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "no_client_writes_dostep" on public.email_skrzynki_dostep;
create policy "no_client_writes_dostep"
  on public.email_skrzynki_dostep for all
  to authenticated
  using (false)
  with check (false);

-- ----------------------------------------------------------------------------
-- Trigger: updated_at
-- ----------------------------------------------------------------------------
create or replace function public.tg_email_skrzynki_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists email_skrzynki_set_updated_at on public.email_skrzynki;
create trigger email_skrzynki_set_updated_at
  before update on public.email_skrzynki
  for each row execute function public.tg_email_skrzynki_set_updated_at();
