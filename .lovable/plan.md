## Cel
Umożliwić powiązanie **osób z modułu Kontakty** z **kontrahentami** (organizacjami) w obu kierunkach:
- W dialogu kontrahenta (Dodaj / Edytuj): przyciski **„Dodaj kontakt"** i **„Powiąż z kontaktem"**.
- W formularzu kontaktu: przycisk **„Powiąż z kontrahentem"**.

Powiązania mają być widoczne (lista powiązanych osób na kontrahencie i lista powiązanych kontrahentów na kontakcie) i odpinalne.

## Zakres

### 1. Baza danych – nowa migracja
Plik: `supabase/migrations/0022_contact_counterparty_links.sql`

Tabela `contact_counterparty_links`:
- `id uuid pk`
- `contact_id uuid → contacts(id) on delete cascade`
- `counterparty_org_id uuid → organizations(id) on delete cascade`
- `owner_kind text check ('user'|'org')` – do którego scope'u należy link (czyj jest „mój kontrahent")
- `owner_user_id uuid null` / `owner_org_id uuid null` – analogicznie do `counterparty_links`
- `note text null`, `created_by uuid`, `created_at timestamptz`
- `unique (contact_id, counterparty_org_id, owner_kind, owner_user_id, owner_org_id)`

`GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated`, `GRANT ALL … TO service_role`, RLS:
- SELECT/INSERT/DELETE dla zalogowanego, gdy `owner_user_id = auth.uid()` (etap 1 – tylko user scope; org scope w przyszłości).

Migracja jest do uruchomienia ręcznie w panelu Supabase (zgodnie z core memory).

### 2. Server functions – nowy plik
`src/lib/contact-counterparty-links.functions.ts`:
- `linkContactToCounterparty({ contactId, counterpartyOrgId })`
- `unlinkContactFromCounterparty({ linkId })`
- `listLinkedContactsForCounterparty({ counterpartyOrgId })` – do wyświetlania w dialogu kontrahenta
- `listLinkedCounterpartiesForContact({ contactId })` – do wyświetlania w formularzu kontaktu
- `listLinkableCounterparties({ search? })` – moi kontrahenci do wyboru w pickerze (z `counterparty_links` + dane org)
- `listLinkableContacts({ search? })` – moje kontakty osobowe (z `contacts` scope=user) do wyboru w pickerze

Wszystkie pod `requireSupabaseAuth`, scope = user (etap 1).

### 3. UI – dialog kontrahenta
W `AddCounterpartyDialog.tsx` (krok 2) i `CounterpartyDetailsDialog.tsx` dodać sekcję **„Powiązane kontakty"** z dwoma przyciskami:
- **„Dodaj kontakt"** – otwiera zagnieżdżony Dialog z `ContactForm` (scope=user); po zapisaniu nowy kontakt jest od razu linkowany z kontrahentem.
- **„Powiąż z kontaktem"** – otwiera `ContactPicker` (Command/Combobox z wyszukiwarką) z listą moich kontaktów; wybór → utworzenie linku.

Pod przyciskami: lista już powiązanych kontaktów (badge + przycisk „odłącz").

Uwaga: w `AddCounterpartyDialog` linki dla **nowego prywatnego kontrahenta** trzeba zapisać dopiero po `createCounterpartyDraft` (mamy `organizationId`). Dla „zarejestrowanego" (przycisk Add w wynikach wyszukiwania) – sekcja powiązań pojawia się po utworzeniu linku przez `addCounterpartyLink` lub w `CounterpartyDetailsDialog` po wejściu w istniejącego kontrahenta.

### 4. UI – formularz kontaktu
W `ContactForm.tsx` dodać sekcję **„Powiązani kontrahenci"**:
- Przycisk **„Powiąż z kontrahentem"** – otwiera `CounterpartyPicker` (Command z listą moich kontrahentów) → tworzy link.
- Lista powiązanych kontrahentów (badge + odłącz).

Sekcja aktywna tylko gdy kontakt już istnieje (`initial?.id`). Dla nowo tworzonego: pokazujemy info „zapisz najpierw, by powiązać".

### 5. Wspólne komponenty
- `src/components/pickers/ContactPicker.tsx` – Command popover z wyszukiwarką po `display_name`.
- `src/components/pickers/CounterpartyPicker.tsx` – analogicznie po nazwie organizacji.

### 6. i18n
Nowe klucze w `src/locales/pl.ts` i `src/locales/en.ts` (sekcja `contacts.links.*` i `organizations.counterparties.contact_links.*`).

## Pliki do zmian
- **nowe**: `supabase/migrations/0022_contact_counterparty_links.sql`, `src/lib/contact-counterparty-links.functions.ts`, `src/components/pickers/ContactPicker.tsx`, `src/components/pickers/CounterpartyPicker.tsx`
- **edycja**: `src/components/organizations/AddCounterpartyDialog.tsx`, `src/components/organizations/CounterpartyDetailsDialog.tsx`, `src/components/contacts/ContactForm.tsx`, `src/locales/pl.ts`, `src/locales/en.ts`

## Pytania przed startem
1. Czy powiązania mają być również dostępne w **scope organizacji** (kontakty firmowe ↔ kontrahenci tej organizacji), czy na razie **tylko user scope** (moje kontakty ↔ moi kontrahenci)? Etap 1 zakładam tylko user.
2. Czy „Dodaj kontakt" w dialogu kontrahenta zawsze tworzy kontakt w **moim** module (scope=user), nawet jeśli kontrahent jest „zarejestrowany"? Zakładam: tak.
