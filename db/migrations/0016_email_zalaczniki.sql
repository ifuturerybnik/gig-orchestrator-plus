-- ============================================================================
-- Concertivo — migracja 0016: załączniki wiadomości email
-- ============================================================================
-- Załączniki INBOX (synchronizowane przez mail-proxy) oraz wysyłanych
-- (Compose / Autokorespondencja). storage_path → bucket 'email-attachments'.
-- inline + content_id służą do osadzania obrazków cid: w body HTML.
--
-- INSTRUKCJA: Wklej w SQL Editor → Run. Idempotentne.
-- ============================================================================

create table if not exists public.email_zalaczniki (
  id uuid primary key default gen_random_uuid(),
  wiadomosc_id uuid references public.email_wiadomosci(id) on delete cascade,
  -- powiązanie z draftem/wysyłką gdy wiadomość jeszcze nie zsynchronizowana z IMAP
  draft_id uuid,

  nazwa text not null,
  mime_type text,
  rozmiar_bajty bigint,
  storage_path text not null,

  inline boolean not null default false,
  content_id text,

  created_at timestamptz not null default now()
);

create index if not exists email_zalaczniki_wiadomosc_idx on public.email_zalaczniki(wiadomosc_id);
create index if not exists email_zalaczniki_draft_idx on public.email_zalaczniki(draft_id);

grant select, insert, update, delete on public.email_zalaczniki to authenticated;
grant all on public.email_zalaczniki to service_role;

alter table public.email_zalaczniki enable row level security;

-- Dostęp: jeśli załącznik pyta przez wiadomosc_id — sprawdzamy uprawnienia do skrzynki tej wiadomości.
-- Drafty: tylko właściciel (logika kontrolowana w server fn — RLS na razie pozwala authenticated, server fn waliduje).
drop policy if exists email_zalaczniki_select on public.email_zalaczniki;
create policy email_zalaczniki_select on public.email_zalaczniki for select to authenticated
using (
  wiadomosc_id is null
  or exists (
    select 1 from public.email_wiadomosci w
    join public.email_skrzynki s on s.id = w.skrzynka_id
    where w.id = email_zalaczniki.wiadomosc_id
      and (
        (s.typ = 'osobista' and s.owner_user_id = auth.uid())
        or (s.typ = 'wspolna' and exists (
          select 1 from public.organization_members om
          where om.organization_id = s.organization_id and om.user_id = auth.uid()
        ))
      )
  )
);

drop policy if exists email_zalaczniki_insert on public.email_zalaczniki;
create policy email_zalaczniki_insert on public.email_zalaczniki for insert to authenticated with check (true);

drop policy if exists email_zalaczniki_delete on public.email_zalaczniki;
create policy email_zalaczniki_delete on public.email_zalaczniki for delete to authenticated using (true);
