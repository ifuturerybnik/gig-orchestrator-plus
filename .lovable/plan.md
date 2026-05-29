# Moduł "Występy" (dawniej "Koncerty / Wydarzenia")

## 1. Zmiana nazwy zakładki

W sidebarze organizacji (`src/components/org-sidebar.tsx`) klucz `organizations.sidebar.events` pozostaje, ale w `src/locales/pl.ts` i `en.ts` zmieniam tłumaczenie na **„Występy" / „Performances"**. Ścieżka `/organizations/:orgId/events` bez zmian (mniej refaktoringu, brak zerwania linków).

## 2. Baza danych — nowa migracja `db/migrations/0023_performances.sql`

```sql
create type public.performance_status as enum (
  'inquiry',              -- Zapytanie
  'tentative',            -- Wstępna rezerwacja
  'confirmed_signing',    -- Potwierdzony (w trakcie podpisywania)
  'confirmed_signed'      -- Potwierdzony (umowa podpisana)
);

create type public.performance_visibility as enum (
  'private',              -- Tylko dla mnie
  'members_date',         -- Członkowie: tylko data
  'members_full',         -- Członkowie: wszystko
  'public_date',          -- Publiczne: tylko data
  'public_full'           -- Publiczne: wszystko
);

create table public.performances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  performance_date date not null,
  status public.performance_status not null,
  visibility public.performance_visibility not null default 'private',
  name text,
  city text,
  postal_code text,
  street text,
  street_number text,
  google_maps_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.performances(organization_id, performance_date desc);

create table public.performance_assignments (
  id uuid primary key default gen_random_uuid(),
  performance_id uuid not null references public.performances(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  counterparty_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((contact_id is not null) <> (counterparty_id is not null))
);
create unique index on public.performance_assignments(performance_id, contact_id) where contact_id is not null;
create unique index on public.performance_assignments(performance_id, counterparty_id) where counterparty_id is not null;

grant select, insert, update, delete on public.performances to authenticated;
grant all on public.performances to service_role;
grant select, insert, update, delete on public.performance_assignments to authenticated;
grant all on public.performance_assignments to service_role;

alter table public.performances enable row level security;
alter table public.performance_assignments enable row level security;

-- Członkowie organizacji mogą czytać/pisać występy swojej organizacji
create policy "members read performances"
  on public.performances for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));
create policy "members write performances"
  on public.performances for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

create policy "members rw assignments"
  on public.performance_assignments for all to authenticated
  using (exists (select 1 from public.performances p
                 where p.id = performance_id
                   and public.is_org_member(p.organization_id, auth.uid())))
  with check (exists (select 1 from public.performances p
                 where p.id = performance_id
                   and public.is_org_member(p.organization_id, auth.uid())));
```

> Zakładam istnienie funkcji `public.is_org_member(uuid, uuid)`. Jeśli w bazie ma inną nazwę — dostosuję policy do faktycznego helpera użytego w innych tabelach (sprawdzę przed wygenerowaniem migracji).

Użytkownik wykona migrację ręcznie w panelu Supabase (zgodnie z core memory).

## 3. Server functions — `src/lib/performances.functions.ts`

- `listPerformances({ organizationId })` — lista posortowana po dacie
- `createPerformance({ organizationId, ...fields, assignments: { contactIds, counterpartyIds } })` — walidacja Zod po stronie serwera odzwierciedlająca reguły warunkowe (patrz §5)
- `listAssignments({ performanceId })` — dla widoku szczegółów (przyszłość)

Wszystko z `requireSupabaseAuth`.

## 4. UI — strona występów

`src/routes/_authenticated.organizations.$orgId.events.tsx`:
- nagłówek „Występy" + przycisk **„Dodaj występ"** (otwiera `PerformanceDialog`)
- tabela: Data, Status (badge), Nazwa, Miejscowość, Widoczność (ikona), Akcje
- pusty stan gdy brak rekordów

## 5. Dialog `src/components/performances/PerformanceDialog.tsx`

Pola w kolejności:
1. **Data występu** — `<Popover>` + `<Calendar mode="single">` (shadcn), zawsze wymagane
2. **Status** — `<Select>` z 4 opcjami
3. **Widoczność** — `<Select>` z 5 opcjami
4. **Nazwa występu** — `<Input>`
5. **Miejscowość, Kod pocztowy, Ulica, Numer** — 4 inputy w gridzie 2 kol.
6. **Pinezka Google (URL)** — `<Input type="url">`

**Walidacja warunkowa (Zod + react-hook-form):**

| Pole | inquiry / tentative | confirmed_signing / confirmed_signed |
|---|---|---|
| Nazwa | opcjonalne | **wymagane** |
| Miasto, kod, ulica, numer | opcjonalne | **wymagane** |
| Pinezka Google | wymagana tylko gdy `visibility === 'public_full'` | jw. |

Sekcja **Przypisania** (na końcu dialogu, nad przyciskami):
- Listy chipów przypisanych kontaktów i kontrahentów (z X)
- 2 przyciski: **„Przypisz kontakt"**, **„Przypisz kontrahenta"**
- Klik → otwiera istniejący `ContactPicker` / `CounterpartyPicker` (z `excludeIds`)
- Po wybraniu wołam `listLinkedCounterpartiesForContact` / `listLinkedContactsForCounterparty` — jeśli zwróci powiązania których nie ma jeszcze na liście, pokazuję **toast z akcją „Dodaj też"** (sonner action button) sugerujący dopisanie powiązanego kontaktu/kontrahenta
- W pickerze (oba istnieją) — gdy lista pusta lub user nie znajduje → przyciski **„Dodaj kontakt"** / **„Dodaj kontrahenta"** otwierające istniejące `ContactForm` / `AddCounterpartyDialog` (sprawdzę, czy pickery już je mają; jeśli nie — dodam).

Submit → `createPerformance` → invalidate `["performances", orgId]` → toast → close.

## 6. i18n

Nowe klucze pod `organizations.performances.*` (lista, dialog, statusy, widoczności, walidacje) w `pl.ts` (komplet) i `en.ts` (odpowiedniki). Klucz `organizations.sidebar.events` → „Występy" / „Performances".

## 7. Akcje użytkownika (po wdrożeniu)

Uruchomić migrację `0023_performances.sql` w panelu Supabase. Brak nowych sekretów.

## Czego NIE robię w tej turze

- Edycji/usuwania występów (tylko create + list)
- Widoku szczegółów (`/events/$id`)
- Publicznej strony organizacji wyświetlającej upublicznione występy
- Eksportu/iCal

Te elementy zrobię w kolejnych turach po Twoim potwierdzeniu UI.
