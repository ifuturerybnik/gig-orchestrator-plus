## Kontekst — co przejrzałem w CRM Hub

CRM Hub używa **innego stosu** (Vite + react-router-dom, single-tenant), Concertivo to **TanStack Start + org-scoped routing**. Port nie może być 1:1 — trzeba przepisać warstwę routingu i pozycjonować moduły globalnie pod organizacją.

**Skala kodu do portu:**
- `src/pages/Mail.tsx` — 904 linie (lista folderów, lista maili, podgląd, akcje)
- `src/pages/Autokorespondencja.tsx` — 231 linii (lista kampanii + statystyki)
- `src/pages/AutokorespondencjaSzczegoly.tsx` — szczegóły kampanii
- `src/components/mail/` — ComposeDialog, SzablonyManager, SzablonPicker, LinkiSledzaceDialog, LinkiSledzaceQuickButton, ZwrotyDialog
- `src/components/autokorespondencja/` — AutokorespondencjaWizardDialog (~1300 linii), AutokorFiltersStep, ListaRezygnacjiDialog, ListaOdbiciaDialog, leadFilterMatching
- `src/components/ui/wysiwyg-editor.tsx` — ~527 linii, Tiptap (StarterKit + 12 rozszerzeń)
- Hooki: `useSkrzynki`, `useWiadomosci`, `useAutokorespondencje`, `useUpsertAutokorespondencja`, `useReplaceWarianty`, `useAutokorWiadomosci`, helpery `useLeadyByEmails`/`useKlienciByEmails`/`useDostawcyByEmails`

## Etap 0 — Globalny edytor WYSIWYG (FUNDAMENT, pierwszy do zrobienia)

Przed czymkolwiek innym, bo używa go i Compose, i Wizard autokorespondencji, i szablony.

1. Instaluję pakiety Tiptap: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-{underline,link,color,font-family,highlight,text-align,text-style,table,table-cell,table-header,table-row}`, `dompurify`, `@types/dompurify`.
2. Tworzę `src/components/ui/wysiwyg-editor.tsx` — port 1:1 z CRM Hub (toolbar, sanitizacja DOMPurify, wstawianie obrazków, linki, tabele, podpowiedzi, props `hideHeadings`, `placeholder`, `value`, `onChange`).
3. Dodaję wpis w `mem://design/wysiwyg-editor` + linijka w `mem://index.md` Core: „**Każdy edytor tekstu sformatowanego = `WysiwygEditor` z `@/components/ui/wysiwyg-editor`. Nie pisać własnych edytorów ani nie używać raw `contentEditable`/`<textarea>` tam, gdzie potrzebne formatowanie.**"

## Etap 1 — Wspólny moduł „Korespondencja" (globalny, org-scoped)

Tworzę nowe trasy pod istniejącym layoutem organizacji:

```text
src/routes/_authenticated.organizations.$orgId.korespondencja.tsx           (layout + redirect → poczta)
src/routes/_authenticated.organizations.$orgId.korespondencja.poczta.tsx
src/routes/_authenticated.organizations.$orgId.korespondencja.autokorespondencja.tsx
src/routes/_authenticated.organizations.$orgId.korespondencja.autokorespondencja.$kampaniaId.tsx
```

Dodaję pozycje w `org-sidebar.tsx`: grupa „Korespondencja" → „Poczta" + „Autokorespondencja" (zgodnie z CRM Hub AppSidebar). Wszystkie napisy przez i18next (klucze `correspondence.*`).

Reguła pamięci: `mem://features/correspondence-module` — moduł jest globalny, w każdej organizacji (firmy eventowe, estradowe itd.) używamy tych samych komponentów; nowe typy organizacji tylko podpinają sidebar.

## Etap 2 — Migracje DB (do ręcznego wykonania w Supabase)

Tworzę pliki w `supabase/migrations/` (numerowane po ostatniej):

- `0015_email_zalaczniki.sql` — załączniki maili + bucket `email-attachments` (jeśli brak)
- `0016_email_szablony.sql` — szablony wiadomości (org-scoped, RLS po membership)
- `0017_email_stopki.sql` — stopki użytkownika
- `0018_email_linki_sledzace.sql` — śledzenie kliknięć linków
- `0019_autokorespondencje.sql` — kampanie (status: draft/scheduled/running/paused/done/cancelled)
- `0020_autokorespondencje_warianty.sql` — warianty A/B treści
- `0021_autokorespondencje_wiadomosci.sql` — kolejka wysyłki per odbiorca
- `0022_autokorespondencje_lista_rezygnacji.sql` — unsubscribes (per-org)
- `0023_autokorespondencje_lista_odbicia.sql` — bounces (per-org)
- `0024_autokor_pixel.sql` — endpoint/tabela pikseli tracking

Wszystko z RLS po `org_members`, kolumny `organization_id`, `created_by`. Daję Ci listę do wklejenia w Supabase Studio (tak jak wcześniej z `0014_email_wiadomosci.sql`).

## Etap 3 — Port komponentów

Adaptacje względem CRM Hub:
- `react-router-dom` → `@tanstack/react-router` (`useNavigate`, `Link`, `useParams`)
- Wszystkie zapytania scope'owane do `organizationId` z params route'a
- Hooki przeniesione do `src/hooks/` z prefixem `useOrg*` lub po prostu `useSkrzynki(orgId)`
- Wszystkie napisy → `t('correspondence.poczta.*')` etc.
- Komponenty mailowe → `src/components/correspondence/mail/`
- Komponenty autokorespondencji → `src/components/correspondence/autokorespondencja/`
- Hooki integracji CRM (`useLeadyByEmails`, `useKlienciByEmails`, `useDostawcyByEmails`) — **w Concertivo nie ma jeszcze tabel leady/klienci/dostawcy**. Robię stub: zwracają puste mapy, z TODO na podpięcie kiedy moduł CRM powstanie. To nie blokuje wysyłki/odbioru.

## Etap 4 — Backend wysyłki (server functions)

W CRM Hub wysyłka idzie przez Supabase Edge Function `send-mail` + proxy IMAP/SMTP. W Concertivo:
- Odbiór już działa (proxy `mail-proxy-concertivo` + tabele email_skrzynki/email_wiadomosci) ✅
- Wysyłka: dodaję `createServerFn` `sendEmail` w `src/lib/email.functions.ts` — proxy do tego samego `mail-proxy-concertivo` (endpoint `/send`)
- Autokorespondencja dispatcher: `createServerFn` `runAutokorTick` + endpoint `src/routes/api/public/autokor/tick.ts` (HMAC-secured) wywoływany przez pg_cron co 1 min

## Etap 5 — Reguły pamięci (kończąc)

Aktualizuję `mem://index.md` Core + tworzę:
- `mem://design/wysiwyg-editor` — zawsze ten komponent
- `mem://features/correspondence-module` — moduł globalny, ten sam dla każdego typu organizacji
- `mem://features/autokorespondencja` — schemat kampanii/wariantów/dispatchera

## Co MUSZĘ wiedzieć od Ciebie zanim ruszę

1. **Zakres pierwszego kroku**: czy mam zrobić wszystko w jednym podejściu (długi commit, dużo migracji), czy podzielić na podejścia (najpierw WYSIWYG + Poczta, potem Autokorespondencja)?
2. **Brakujące dane CRM** (leady/klienci/dostawcy): potwierdzasz, że na razie autokorespondencja ma listę odbiorców tylko jako **CSV upload + ręczna lista** (bez integracji z bazą kontaktów), a integracja z kontaktami doleci jak powstanie moduł CRM organizacji?
3. **Wysyłka SMTP**: czy mam dopisać endpoint `/send` w proxy `mail-proxy-concertivo` (analogicznie do `/sync`), czy proxy już to umie i tylko nie używamy?
4. **Tracking pixel/unsubscribe**: pixel + link rezygnacji muszą być publicznym URL-em. OK z `https://project--05f60994-...lovable.app/api/public/autokor/...` jako bazą, czy chcesz na docelowej domenie?

Po odpowiedziach ruszam od Etapu 0 (WYSIWYG + reguła w pamięci) — to bezpieczny krok bez zależności od backendu.