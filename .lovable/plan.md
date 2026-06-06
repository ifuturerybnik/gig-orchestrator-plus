# Plan: kontrola synchronizacji social i auto-moderacja AI

Trzy warstwy zgodnie z ustaleniem: globalne crony zostają, użytkownik dostaje on/off per konto, administrator i-Future dostaje panel z limitami i historią ticków.

## 1. Baza danych (migracja `supabase/migrations/0047_social_sync_controls.sql`)

**`social_accounts` — nowe kolumny:**
- `auto_sync_inbox boolean not null default true` — czy cron sync-inbox/metrics ma obsługiwać to konto
- `auto_ai_moderation boolean not null default false` — czy nowe komentarze mają być automatycznie klasyfikowane przez OpenAI (sentyment + flagi hejt/spam)
- `sync_paused_until timestamptz null` — opcjonalna ręczna pauza („wyłącz na 24h")

**Nowa tabela `app_settings` (singleton key/value, tylko admin):**
```
key text primary key
value jsonb not null
updated_at timestamptz, updated_by uuid
```
Seed wartości startowych:
- `social.sync_inbox.max_posts` = 200
- `social.sync_inbox.window_days` = 30
- `social.sync_metrics.max_posts` = 200
- `social.sync_metrics.window_days` = 30
- `social.import_posts.per_account_limit` = 25
- `social.import_posts.max_accounts` = 500
- `social.ai_moderation.daily_budget_per_org` = 500 (twardy limit calls do OpenAI dziennie / org)

RLS: select dla `authenticated` (potrzebne, by zwykli userzy nie musieli czytać — ale przyda się np. do UI „kiedy ostatnio sync"), update/insert/delete tylko `service_role` (zapis przez server fn z guard `requireAdmin`).

**Nowa tabela `social_sync_runs` (audit / monitoring):**
```
id uuid pk, job text (sync-inbox|sync-metrics|import-posts),
started_at, finished_at, duration_ms int,
processed int, inserted int, ok int, fail int,
skipped_permission int, skipped_disabled int,
error_summary jsonb (top 5 ostatnich błędów)
```
Indeks po `(job, started_at desc)`. RLS: select dla admin, insert tylko `service_role`.

## 2. Server functions (`src/lib/admin-social.functions.ts`, nowy plik)

- `getSocialSettings()` — pobiera wszystkie klucze `social.*` z `app_settings`. Guard: `requireAdmin`.
- `updateSocialSettings({ patch })` — walidacja Zod z twardymi min/max (np. `max_posts ∈ [10, 1000]`, `window_days ∈ [1, 90]`), zapis batch, audit do `app_admin_audit` (jeśli istnieje, inaczej tylko `updated_by`). Guard: `requireAdmin`.
- `listSyncRuns({ job?, limit=50 })` — historia ticków dla panelu. Guard: `requireAdmin`.

Helper `src/lib/social-settings.server.ts` z cache 60s w pamięci modułu (worker request) — żeby cron nie pytał DB 3× za każdym tickiem.

## 3. Cron endpoints — zmiany

Wszystkie trzy (`social-import-posts.ts`, `social-sync-inbox.ts`, `social-sync-metrics.ts`):
1. Na początku tick'a czytają limity z `app_settings` (fallback do dotychczasowych stałych).
2. Filtr SQL rozszerzony o:
   - `social_accounts.auto_sync_inbox = true`
   - `social_accounts.sync_paused_until is null or sync_paused_until < now()`
3. Po zakończeniu: insert do `social_sync_runs` z metrykami (processed, inserted, fail, skipped_permission, skipped_disabled, error_summary).

**`social-sync-inbox.ts` dodatkowo:**
- Po pomyślnym upsert nowych komentarzy, jeśli konto ma `auto_ai_moderation = true` ORAZ org nie przekroczyła dziennego budżetu (`social.ai_moderation.daily_budget_per_org` vs count z `ai_uzycie` z dziś), wywołuje `aiModerateComment` dla świeżo wstawionych wierszy (max 20 / tick / konto — żeby nie zarżnąć OpenAI).
- Wynik (sentyment + flagi) zapisywany do `social_comments.ai_sentiment` / `ai_flags` (kolumny już istnieją).
- Limit dzienny — wystarczy zliczyć `ai_uzycie` z dziś per organizacja; przy przekroczeniu pomijamy z `skipped_budget++`.

## 4. UI — użytkownik (per konto)

**`AccountDetailsDialog.tsx`** — nowa sekcja „Automatyzacja":
- Switch `t('social.account.auto_sync')` → `auto_sync_inbox`
- Switch `t('social.account.auto_ai_moderation')` → `auto_ai_moderation` z notką „wymaga skonfigurowanego klucza OpenAI w organizacji"
- Przycisk „Wstrzymaj sync na 24h" → ustawia `sync_paused_until = now() + 24h`, pokazuje countdown jeśli aktywna
- Disabled switch auto-AI, jeśli organizacja nie ma `ai_konfiguracja` z OpenAI

Zmiany zapisywane przez istniejący `updateSocialAccount` (rozszerzenie payloadu) lub nowy `setAccountAutomation`.

## 5. UI — administrator i-Future

**Nowa strona `/admin/social` (`_authenticated.admin.social.tsx`):**
- Dwa taby: **Limity** + **Historia synchronizacji**
- **Limity**: formularz z polami liczbowymi dla wszystkich kluczy `social.*`, każde z min/max i tooltipem („wpływa na cron co X minut, sumarycznie dla wszystkich organizacji"). Submit → `updateSocialSettings`.
- **Historia**: tabela z `social_sync_runs` (filtr po job), kolumny: kiedy, czas trwania, processed, ok, fail, skipped, ostatnie błędy (rozwijane). Auto-refresh co 30s.
- Wejście w sidebarze admina (ikona `Share2`).

## 6. i18n

Klucze do `pl.ts` + `en.ts`:
- `social.account.automation.*` (sekcja w dialogu konta)
- `admin.nav.social`, `admin.social.title`, `admin.social.limits.*`, `admin.social.runs.*`

## 7. Co świadomie NIE robimy w tej iteracji

- Webhooków Meta (osobny temat — wymaga app review).
- Per-organizacyjnego ustawiania częstotliwości crona (zgodnie z ustaleniem — to globalny parametr aplikacji).
- Alarmów e-mail przy fail rate > X% (można dodać później po zobaczeniu danych w historii).

## 8. Kolejność wdrożenia

1. Migracja 0047 (user wykonuje ręcznie w Supabase).
2. `social-settings.server.ts` + `admin-social.functions.ts`.
3. Modyfikacja 3 cronów (filtr + zapis run + auto-AI w inbox).
4. UI per-konto w `AccountDetailsDialog`.
5. UI `/admin/social` + wpis w nawigacji.
6. i18n pl/en.

Daj znać czy zatwierdzasz — wtedy startuję od migracji.
