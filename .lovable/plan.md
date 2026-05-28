
# Plan: Moduł Korespondencja w panelu organizacji

## Cel
W bocznym menu organizacji dodać zakładkę **Korespondencja** rozwijającą się na dwie podzakładki: **Poczta** i **Autokorespondencja**. Funkcjonalność 1:1 jak w CRM Hub, ale:
- adaptacja z react-router-dom → TanStack Start (routes pliki + `createServerFn`),
- filtry i pola dynamiczne dopasowane do encji Concertivo (kontakty, kontrahenci, organizacje) zamiast `leady/klienci/dostawcy`,
- WYSIWYG: używamy istniejącego globalnego `@/components/ui/wysiwyg-editor` (już jest w projekcie),
- moduł GLOBALNY — działa dla każdego typu organizacji (zgodnie z istniejącą notką w pamięci).

## Co już mamy (NIE robimy ponownie)
- `email_skrzynki`, `email_wiadomosci` (migracje 0013/0014)
- `mail-proxy.server.ts`, `mail-crypto.server.ts`, `email-skrzynki.functions.ts`
- `StopkaPicker`, `StopkiManager`, `org-mailboxes-section`
- Globalny `WysiwygEditor` (Tiptap)
- Auth/middleware, `attachSupabaseAuth`, RLS

## Zakres prac

### 1. Sidebar — grupa rozwijana „Korespondencja"
- Refactor `src/components/org-sidebar.tsx`: dodać sekcję z `Collapsible` (shadcn) nad „Członkowie", zawierającą:
  - `Poczta` → `/organizations/$orgId/mail`
  - `Autokorespondencja` → `/organizations/$orgId/autokorespondencja`
- Tłumaczenia w `src/locales/pl.ts` i `en.ts` (`organizations.sidebar.correspondence/mail/autokor`).

### 2. Migracje SQL (`db/migrations/`)
Nowe pliki — wykonasz ręcznie w panelu zewnętrznego Supabase:
- `0015_email_szablony.sql` — szablony wiadomości (per user / per organization, z polem `body_html`, `temat`, `kategoria`, `zmienne`).
- `0016_email_zalaczniki.sql` — załączniki wiadomości (storage path, inline cid, content_id).
- `0017_email_linki_sledzace.sql` — śledzenie kliknięć linków (per wysłana wiadomość).
- `0018_email_odbicia_rezygnacje.sql` — bounce list + lista rezygnacji (suppressions).
- `0019_autokorespondencje.sql` — kampanie + `autokorespondencje_wiadomosci` (status: pending/sent/failed/skipped, planowana_wysylka, klikniecia, otwarcia).
- Każda tabela: GRANT-y + RLS scoped per user lub org-member (wzorem `email_skrzynki`).

### 3. Server functions (`src/lib/`)
- `email-szablony.functions.ts` — CRUD szablonów (scope user/org).
- `email-wiadomosci.functions.ts` — list/search/markRead/star/move/delete (proxy do `mail-proxy`).
- `email-send.functions.ts` — wysyłka pojedyncza (przez `callMailProxy('send', ...)`), zapis log + zalączniki.
- `email-attachments.functions.ts` — signed URL + upload do bucketu `email-attachments`.
- `email-tracking.functions.ts` — listy bounce'ów, rezygnacji, kliknięć.
- `autokorespondencje.functions.ts` — CRUD kampanii, start/pause/cancel/clone, statystyki.
- Server route publiczne (TSS) pod `/api/public/`:
  - `unsubscribe` — odbiór klika z linka rezygnacji,
  - `track-open` (pixel 1×1),
  - `track-click` (redirect z logowaniem),
  - `autokor-tick` (cron co minutę — generuje kolejną partię wiadomości do wysyłki).

### 4. Komponenty UI (`src/components/mail/` + `src/components/autokorespondencja/`)
**Mail:**
- `MailLayout.tsx` — lewy panel (skrzynki + foldery), środek (lista wiadomości), prawy (podgląd) — port z `Mail.tsx`.
- `ComposeDialog.tsx` — kompozycja maila (WysiwygEditor + StopkaPicker + załączniki + Do/CC/BCC z ContactPicker + wybór szablonu).
- `SzablonyManager.tsx`, `SzablonPicker.tsx` — biblioteka szablonów.
- `LinkiSledzaceDialog.tsx`, `ZwrotyDialog.tsx` — statystyki tracking.
- Hook adapter `useResolvedHtmlBody` (cid → signed URL).

**Autokorespondencja:**
- `AutokorespondencjaList.tsx` — tabela kampanii + akcje (pause/play/cancel/clone/delete/edit).
- `AutokorespondencjaWizardDialog.tsx` — kreator wieloetapowy:
  1. Nazwa + skrzynka nadawcza + szablon/treść (WysiwygEditor),
  2. **Filtry odbiorców** — dostosowane do Concertivo: typ kontaktu (person/company/artist), tagi, klasyfikacja, kraj/miasto, źródło (moje vs org), lista kontrahentów, status koncertów, gatunki muzyczne (z `genres.ts`),
  3. Harmonogram (godzina/dni tygodnia, rate-limit per minuta),
  4. Podgląd listy + start.
- `ListaRezygnacjiDialog.tsx`, `ListaOdbiciaDialog.tsx`.
- `AutokorespondencjaSzczegoly.tsx` (route detail) — wykres postępu, lista wiadomości z filtrami statusu.

**Pola dynamiczne w szablonach** (zamiast CRM Hub'owych `{{lead.imie}}`):
- `{{kontakt.imie}}`, `{{kontakt.nazwisko}}`, `{{kontakt.email}}`, `{{kontakt.firma}}`
- `{{kontrahent.nazwa}}`, `{{kontrahent.nip}}`
- `{{organizacja.nazwa}}`, `{{uzytkownik.imie}}`, `{{data.dzisiaj}}`
- Engine podmiany w `src/lib/email-template-vars.ts`.

### 5. Routes (TanStack)
- `src/routes/_authenticated.organizations.$orgId.mail.tsx`
- `src/routes/_authenticated.organizations.$orgId.autokorespondencja.tsx`
- `src/routes/_authenticated.organizations.$orgId.autokorespondencja.$kampaniaId.tsx`
- `src/routes/api/public/email-unsubscribe.tsx`
- `src/routes/api/public/email-track-open.tsx`
- `src/routes/api/public/email-track-click.tsx`
- `src/routes/api/public/autokor-tick.tsx`

### 6. i18n
Komplet kluczy w `pl.ts` i `en.ts` dla wszystkich nowych ekranów (sidebar, lista, wizard, dialogi, błędy, toasty).

### 7. Pamięć projektu
Aktualizacja `mem://features/correspondence-module` o końcowe lokalizacje plików, listę tabel i punkty stylu pól dynamicznych.

## Czego NIE robimy w tym kroku
- Nie zmieniamy `mail-proxy` na VPS — wykorzystujemy istniejące endpointy (`sync/body-sync/body/send/mark`). Jeśli okaże się że brakuje endpointu (np. wysyłka z załącznikami z pełnym MIME) — dopiero wtedy dodam zadanie.
- Nie portujemy ekranów CRM Hub niedotyczących maila (Leady, Klienci, Dostawcy).
- Nie ruszamy logiki kontrahentów/kontaktów — używamy istniejących `ContactPicker` / `CounterpartyPicker` jako adresatów.

## Kolejność wykonania (etapy)
1. Sidebar + puste routes + i18n (szybko, sprawdzimy nawigację).
2. Migracje SQL (dostarczę pliki — wykonujesz ręcznie, czekam na potwierdzenie).
3. Server functions + tracking endpoints.
4. UI Poczta (lista folderów → lista wiadomości → podgląd → Compose).
5. Szablony + Stopki integracja.
6. Autokorespondencja (lista → wizard → detail → cron tick).
7. QA, tłumaczenia, memoria.

## Pytanie do Ciebie przed startem
Czy potwierdzasz pełny zakres, czy chcesz najpierw etap **1+2** (sidebar + migracje), zaakceptować, i dopiero potem przejść do UI? Polecam wariant etapowy — całość to ~30–40 nowych plików, łatwiej weryfikować po częściach.
