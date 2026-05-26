-- ============================================================================
-- Concertivo — migracja 0014: wiadomości email + stan synchronizacji + spam
-- ============================================================================
-- Tabele używane przez mail-proxy (mail.concertivo.eu) do przechowywania
-- zsynchronizowanych wiadomości IMAP, kursora UID per folder oraz listy
-- twardo blokowanych nadawców (auto-delete na INBOX).
--
-- INSTRUKCJA: Wklej w SQL Editor zewnętrznego Supabase Concertivo → Run.
-- Plik jest IDEMPOTENTNY.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABELA: email_wiadomosci — meta + treść wiadomości
-- ----------------------------------------------------------------------------
-- Body (HTML/text) jest dociągany asynchronicznie przez runBodySync —
-- przy pierwszym INSERT zostaje NULL, kolumny body_fetch_* sterują retry.
create table if not exists public.email_wiadomosci (
  id uuid primary key default gen_random_uuid(),
  skrzynka_id uuid not null references public.email_skrzynki(id) on delete cascade,
  folder text not null,
  uid bigint not null,
  message_id text,

  od_email text,
  od_nazwa text,
  do_emails jsonb not null default '[]'::jsonb,
  cc_emails jsonb not null default '[]'::jsonb,
  bcc_emails jsonb not null default '[]'::jsonb,

  temat text not null default '(brak tematu)',
  data_wyslania timestamptz,
  data_otrzymania timestamptz not null default now(),

  przeczytana boolean not null default false,
  oznaczona_gwiazdka boolean not null default false,
  ma_zalaczniki boolean not null default false,
  rozmiar_bajty bigint,
  flags jsonb not null default '[]'::jsonb,

  body_html text,
  body_text text,
  body_fetch_attempts integer not null default 0,
  body_fetch_last_error text,
  body_fetch_next_retry_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (skrzynka_id, folder, uid)
);

create index if not exists idx_email_wiadomosci_skrzynka
  on public.email_wiadomosci(skrzynka_id, folder, data_otrzymania desc);
create index if not exists idx_email_wiadomosci_message_id
  on public.email_wiadomosci(message_id) where message_id is not null;
create index if not exists idx_email_wiadomosci_body_retry
  on public.email_wiadomosci(body_fetch_next_retry_at)
  where body_html is null and body_text is null;

-- ----------------------------------------------------------------------------
-- TABELA: email_sync_state — kursor UID per skrzynka+folder
-- ----------------------------------------------------------------------------
create table if not exists public.email_sync_state (
  id uuid primary key default gen_random_uuid(),
  skrzynka_id uuid not null references public.email_skrzynki(id) on delete cascade,
  folder text not null,
  last_uid bigint not null default 0,
  uidvalidity bigint,
  last_sync_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  unique (skrzynka_id, folder)
);

create index if not exists idx_email_sync_state_skrzynka
  on public.email_sync_state(skrzynka_id);

-- ----------------------------------------------------------------------------
-- TABELA: email_twardy_spam_adresy — auto-delete na INBOX
-- ----------------------------------------------------------------------------
-- Proxy przy synchronizacji INBOX sprawdza fromAddress vs ta lista.
-- Jeśli match → wiadomość jest oznaczana \Deleted i usuwana z serwera.
create table if not exists public.email_twardy_spam_adresy (
  id uuid primary key default gen_random_uuid(),
  skrzynka_id uuid not null references public.email_skrzynki(id) on delete cascade,
  email text not null,
  powod text,
  created_at timestamptz not null default now(),
  unique (skrzynka_id, email)
);

create index if not exists idx_email_twardy_spam_skrzynka
  on public.email_twardy_spam_adresy(skrzynka_id);

-- ----------------------------------------------------------------------------
-- RLS — wiadomości widoczne dla właścicieli skrzynek
-- ----------------------------------------------------------------------------
alter table public.email_wiadomosci enable row level security;
alter table public.email_sync_state enable row level security;
alter table public.email_twardy_spam_adresy enable row level security;

-- SELECT: użytkownik widzi wiadomości jeśli ma dostęp do skrzynki
-- (osobista = jego, wspólna = członek organizacji)
drop policy if exists "select_email_wiadomosci_via_skrzynka" on public.email_wiadomosci;
create policy "select_email_wiadomosci_via_skrzynka"
  on public.email_wiadomosci for select
  to authenticated
  using (
    exists (
      select 1 from public.email_skrzynki s
      where s.id = email_wiadomosci.skrzynka_id
        and (
          s.owner_user_id = auth.uid()
          or (
            s.organization_id is not null
            and exists (
              select 1 from public.organization_members om
              where om.organization_id = s.organization_id
                and om.user_id = auth.uid()
            )
          )
        )
    )
  );

-- UPDATE: użytkownik może zmieniać flagi (przeczytana, gwiazdka) swoich wiadomości
drop policy if exists "update_email_wiadomosci_via_skrzynka" on public.email_wiadomosci;
create policy "update_email_wiadomosci_via_skrzynka"
  on public.email_wiadomosci for update
  to authenticated
  using (
    exists (
      select 1 from public.email_skrzynki s
      where s.id = email_wiadomosci.skrzynka_id
        and (
          s.owner_user_id = auth.uid()
          or (
            s.organization_id is not null
            and exists (
              select 1 from public.organization_members om
              where om.organization_id = s.organization_id
                and om.user_id = auth.uid()
            )
          )
        )
    )
  );

-- DELETE: użytkownik może usuwać wiadomości ze swoich skrzynek
drop policy if exists "delete_email_wiadomosci_via_skrzynka" on public.email_wiadomosci;
create policy "delete_email_wiadomosci_via_skrzynka"
  on public.email_wiadomosci for delete
  to authenticated
  using (
    exists (
      select 1 from public.email_skrzynki s
      where s.id = email_wiadomosci.skrzynka_id
        and (
          s.owner_user_id = auth.uid()
          or (
            s.organization_id is not null
            and exists (
              select 1 from public.organization_members om
              where om.organization_id = s.organization_id
                and om.user_id = auth.uid()
            )
          )
        )
    )
  );

-- email_sync_state — tylko proxy (service_role) zapisuje, użytkownik może SELECT
drop policy if exists "select_email_sync_state_via_skrzynka" on public.email_sync_state;
create policy "select_email_sync_state_via_skrzynka"
  on public.email_sync_state for select
  to authenticated
  using (
    exists (
      select 1 from public.email_skrzynki s
      where s.id = email_sync_state.skrzynka_id
        and (
          s.owner_user_id = auth.uid()
          or (
            s.organization_id is not null
            and exists (
              select 1 from public.organization_members om
              where om.organization_id = s.organization_id
                and om.user_id = auth.uid()
            )
          )
        )
    )
  );

-- email_twardy_spam_adresy — pełne CRUD dla właścicieli skrzynki
drop policy if exists "select_email_twardy_spam_via_skrzynka" on public.email_twardy_spam_adresy;
create policy "select_email_twardy_spam_via_skrzynka"
  on public.email_twardy_spam_adresy for select
  to authenticated
  using (
    exists (
      select 1 from public.email_skrzynki s
      where s.id = email_twardy_spam_adresy.skrzynka_id
        and (
          s.owner_user_id = auth.uid()
          or (
            s.organization_id is not null
            and exists (
              select 1 from public.organization_members om
              where om.organization_id = s.organization_id
                and om.user_id = auth.uid()
            )
          )
        )
    )
  );

drop policy if exists "insert_email_twardy_spam_via_skrzynka" on public.email_twardy_spam_adresy;
create policy "insert_email_twardy_spam_via_skrzynka"
  on public.email_twardy_spam_adresy for insert
  to authenticated
  with check (
    exists (
      select 1 from public.email_skrzynki s
      where s.id = email_twardy_spam_adresy.skrzynka_id
        and (
          s.owner_user_id = auth.uid()
          or (
            s.organization_id is not null
            and exists (
              select 1 from public.organization_members om
              where om.organization_id = s.organization_id
                and om.user_id = auth.uid()
            )
          )
        )
    )
  );

drop policy if exists "delete_email_twardy_spam_via_skrzynka" on public.email_twardy_spam_adresy;
create policy "delete_email_twardy_spam_via_skrzynka"
  on public.email_twardy_spam_adresy for delete
  to authenticated
  using (
    exists (
      select 1 from public.email_skrzynki s
      where s.id = email_twardy_spam_adresy.skrzynka_id
        and (
          s.owner_user_id = auth.uid()
          or (
            s.organization_id is not null
            and exists (
              select 1 from public.organization_members om
              where om.organization_id = s.organization_id
                and om.user_id = auth.uid()
            )
          )
        )
    )
  );

-- ----------------------------------------------------------------------------
-- Trigger updated_at
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_email_wiadomosci_updated_at on public.email_wiadomosci;
create trigger trg_email_wiadomosci_updated_at
  before update on public.email_wiadomosci
  for each row execute function public.set_updated_at();

drop trigger if exists trg_email_sync_state_updated_at on public.email_sync_state;
create trigger trg_email_sync_state_updated_at
  before update on public.email_sync_state
  for each row execute function public.set_updated_at();
