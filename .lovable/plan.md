# Moduł Kontakty — Plan

Fundament CRM dla całego systemu. Po nim wracamy do Poczty (kontakty zasilą autouzupełnianie adresatów i historię korespondencji per kontakt).

## 1. Architektura danych

### Migracja `0016_contacts.sql`

**Enumy:**
- `contact_kind`: `'person' | 'company' | 'artist'`
- `contact_scope`: `'user' | 'org'`
- `contact_category`: `'client' | 'supplier' | 'artist' | 'partner' | 'venue' | 'media' | 'other'`

**Tabela `contacts` (wspólna dla wszystkich typów):**

| kolumna | typ | uwagi |
|---|---|---|
| `id` | uuid PK | |
| `scope` | contact_scope | `user` = prywatny, `org` = współdzielony |
| `owner_user_id` | uuid → auth.users | NOT NULL gdy scope=user |
| `org_id` | uuid → organizations | NOT NULL gdy scope=org |
| `kind` | contact_kind | person / company / artist |
| `category` | contact_category | nullable |
| **wspólne** | | |
| `display_name` | text NOT NULL | computed dla person, name dla company/artist |
| `email` | text | główny |
| `phone` | text | E.164 (PhoneInput) |
| `website` | text | |
| `country_code` | text | ISO-3166 alpha-2 (CountrySelect) |
| `address_line1`, `address_line2`, `city`, `postal_code`, `region` | text | |
| `notes` | jsonb | Tiptap JSON (WysiwygEditor) |
| `tags` | text[] | swobodne tagi |
| `source` | text | źródło pozyskania |
| `preferred_language` | text | pl/en/... |
| `assigned_to_user_id` | uuid → auth.users | opiekun (tylko scope=org) |
| `custom_fields` | jsonb | per organizacja, klucz→wartość |
| **person-only** | | |
| `first_name`, `last_name`, `middle_name` | text | |
| `position` | text | stanowisko |
| `company_contact_id` | uuid → contacts(id) | powiązana firma (FK self) |
| `birth_date` | date | |
| `social` | jsonb | `{facebook, instagram, linkedin, x, tiktok, youtube}` |
| **company-only** | | |
| `legal_name` | text | |
| `tax_id` | text | NIP/VAT |
| `registration_no` | text | KRS/REGON |
| **artist-only** | | |
| `artist_type` | text | `'solo' | 'band' | 'ensemble' | 'dj'` |
| `genres` | text[] | |
| `rider_url` | text | |
| `tech_rider_url` | text | |
| `created_at`, `updated_at`, `created_by` | timestamptz / uuid | |

**CHECK constraints:** scope spójny z owner/org; pola person-only NULL gdy kind≠person itd.

**Tabela `contact_members`** (członkowie zespołu / artyści w bandzie):
- `id`, `band_contact_id → contacts(id)`, `person_contact_id → contacts(id)`, `role` (np. "wokal"), `is_leader bool`

**Tabela `contact_activity`** (historia kontaktu — telefony, spotkania, notatki; e-maile podepną się z modułu Poczta przez `related_contact_id`):
- `id`, `contact_id`, `kind` (`'call' | 'meeting' | 'note' | 'task'`), `subject`, `body_json` (Tiptap), `occurred_at`, `created_by`, `created_at`

**Custom fields definition** `contact_custom_field_defs`:
- `id`, `org_id`, `kind` (dla którego typu), `key`, `label_i18n` jsonb, `field_type` (`text|number|date|select|bool`), `options` jsonb, `position int`

**Indeksy:** `(scope, owner_user_id)`, `(scope, org_id)`, `(org_id, kind)`, GIN na `tags`, GIN na `display_name gin_trgm_ops` (search).

**RLS:**
- scope=user: tylko owner widzi/edytuje
- scope=org: członkowie organizacji widzą; edytuje członek z rolą ≥ member (zgodnie z istniejącym `has_org_role`)
- `contact_activity`/`contact_members` dziedziczą po contact

**GRANT:** `SELECT, INSERT, UPDATE, DELETE` dla `authenticated`, `ALL` dla `service_role`.

## 2. Frontend — struktura

### Hooks (`src/hooks/`)
- `useContacts({ scope, orgId, kind?, search?, category? })` — lista z paginacją
- `useContact(id)` — szczegóły + members + recent activity
- `useUpsertContact()`, `useDeleteContact()`
- `useContactCustomFields(orgId, kind)`
- `useContactActivity(contactId)`, `useAddActivity()`

### Komponenty (`src/components/contacts/`)
- `ContactsList.tsx` — tabela z search/filtry (kind, category, tag, scope toggle), sortowanie, paginacja, bulk actions
- `ContactForm.tsx` — formularz uniwersalny, sekcje warunkowe per `kind`; używa `PhoneInput`, `CountrySelect`, `WysiwygEditor`, tag input, custom fields renderer
- `ContactCard.tsx` — widok karty (overview + tabs: Dane / Powiązania / Aktywność / Korespondencja[placeholder] / Custom fields)
- `ContactPicker.tsx` — autouzupełnianie (przyda się Poczcie i innym modułom)
- `BandMembersEditor.tsx` — dla artystów typu band
- `CompanyPeoplePicker.tsx` — dla person → linkowanie do company
- `ContactActivityTimeline.tsx` + `AddActivityDialog.tsx`
- `CustomFieldsManager.tsx` — definicje pól per organizacja (tylko admin/owner)

### CSV Import (`src/components/contacts/import/`)
- `CsvImportWizard.tsx` — 4 kroki:
  1. Upload (drag-drop, parse przez `papaparse`)
  2. Wybór scope + kind + (org)
  3. Mapowanie kolumn CSV → pola kontaktu (auto-detekcja po nazwach: email, phone, name, company...)
  4. Preview + dedup po email (skip / update / create) + import (server fn batch insert z walidacją Zod)
- Server fn `importContacts.functions.ts` — bulk insert z transakcją, raport (utworzone/zaktualizowane/pominięte/błędne)

### Routes (TanStack file-based)
- `_authenticated.contacts.tsx` — layout (sidebar: Moje / [każda organizacja]) + `<Outlet />`
- `_authenticated.contacts.index.tsx` — redirect → moje
- `_authenticated.contacts.me.tsx` — moje kontakty
- `_authenticated.contacts.me.$contactId.tsx` — szczegóły mojego
- `_authenticated.contacts.org.$orgId.tsx` — kontakty organizacji
- `_authenticated.contacts.org.$orgId.$contactId.tsx` — szczegóły
- `_authenticated.contacts.import.tsx` — wizard CSV

Wpięcie do głównej nawigacji (sidebar): nowa pozycja "Kontakty".

## 3. Server functions (`src/lib/contacts.functions.ts`)

Wszystkie z `requireSupabaseAuth`:
- `listContacts({ scope, orgId?, kind?, category?, search?, tag?, page, pageSize })`
- `getContact({ id })` — z members + ostatnie 20 aktywności
- `upsertContact(input)` — Zod walidacja per `kind`
- `deleteContact({ id })`
- `addContactMember(...)`, `removeContactMember(...)`
- `addActivity(...)`, `listActivity(...)`
- `listCustomFieldDefs({ orgId, kind })`, `upsertCustomFieldDef(...)`, `deleteCustomFieldDef(...)`
- `importContactsCsv({ scope, orgId?, kind, rows[] })` — batch z dedup

## 4. i18n

Nowy namespace `contacts.*` w `pl.ts` i `en.ts`:
- typy, kategorie, etykiety pól, komunikaty importu, akcje, puste stany

## 5. Memory updates

Po wdrożeniu — nowa memory `mem://features/contacts-module`:
- Hybryda scope (jak stopki)
- 3 typy w jednej tabeli + CHECK
- Custom fields per org+kind
- ContactPicker do reużycia w Poczcie, eventach, fakturach
- Link person→company; band_members dla artystów

## 6. Etapy realizacji

**Tura 1 — DB + szkielet listy:**
1. Migracja `0016_contacts.sql` (enumy, tabele, RLS, GRANT, indeksy)
2. Hooks bazowe + server fn `listContacts`, `getContact`, `upsertContact`, `deleteContact`
3. Route + `ContactsList` (sidebar scope, search, filtry) + przycisk "Dodaj"
4. `ContactForm` dla wszystkich 3 typów (warunkowe sekcje)
5. i18n
→ test: dodanie kontaktu osoby/firmy/artysty w scope user i org

**Tura 2 — Powiązania + custom fields:**
6. `ContactCard` z tabami
7. Person ↔ Company linkowanie
8. Band members editor
9. CustomFieldsManager + renderer w formularzu

**Tura 3 — Aktywność + Import:**
10. `ContactActivityTimeline` + dodawanie wpisów
11. `ContactPicker` (do podpięcia później w Poczcie)
12. CSV Import Wizard + server fn batch
13. Memory + dokumentacja

**Po Turze 3** — wracamy do Poczty (Compose z autouzupełnianiem z kontaktów, threading z `related_contact_id`).

## 7. Uwagi techniczne

- `display_name` ustawiany triggerem DB dla `kind=person` (concat first+last) lub trzymany jako stored generated column — dla person+company ułatwia search/sort jednym indeksem.
- `pg_trgm` extension (jeśli jeszcze nie włączone) — dla fuzzy search po display_name; jeśli nie chcemy zależności, zostajemy przy `ilike`.
- CSV parser w przeglądarce (`papaparse` — lekki, ~45KB). Sam import wykonuje server fn po stronie serwera (walidacja + bulk insert).
- Dla artystów z plikami rider — uploadujemy do istniejącego bucketa albo nowego `contact-files` (do decyzji w Turze 2).

---

**Decyzje do potwierdzenia przed startem Tury 1:**
1. `pg_trgm` (fuzzy search) — włączamy? (potrzebne dla "zaczyna się od" / literówki w autouzupełnianiu Poczty). Jeśli nie — `ilike '%x%'` wystarczy na początek.
2. `display_name` jako trigger czy generated column? (proponuję trigger — łatwiej obsłużyć NULL middle_name).
3. Robimy Turę 1 całą za jednym zamachem (migracja + lista + formularz), czy dzielimy na mikrokroki z testem po każdym?
