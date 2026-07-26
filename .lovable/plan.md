## Cel

Refaktor e-Doręczeń z jednej systemowej skrzynki (env vars) na model multi-tenant: każdy user i każda organizacja może wgrać własną skrzynkę + QWAC przez UI. Jeden wspólny komponent skrzynki dla trzech miejsc: Administracja, Korespondencja osobista, Korespondencja organizacji.

## Kroki

### 1. Migracja bazy (`db/migrations/0022_ade_mailboxes.sql`)

Tabela `public.ade_mailboxes`:
- `id uuid PK`
- `owner_kind text CHECK IN ('user','org','system')`
- `owner_user_id uuid NULL` (FK auth.users)
- `owner_org_id uuid NULL` (FK organizations)
- `label text` — nazwa własna skrzynki
- `mailbox_address text NOT NULL` (AE:PL-...)
- `client_id text NOT NULL`
- `ade_env text NOT NULL DEFAULT 'prod'` (prod|int)
- `qwac_cert_pem_encrypted text NOT NULL` — szyfrowane `encryptPii`
- `qwac_key_pem_encrypted text NOT NULL`
- `qwac_key_passphrase_encrypted text NULL`
- `api_base text NULL`, `oauth_base text NULL`, `token_path text NULL` — nadpisania
- `is_active bool DEFAULT true`, `created_at`, `updated_at`

RLS:
- user widzi/edytuje własne (owner_user_id = auth.uid())
- org: członek organizacji z uprawnieniem — użyję istniejącej funkcji has_org_role
- system: tylko super_admin/admin_staff

Migracja tabel `edoreczenia_deliveries` / `_attachments` / `_sync_state`:
- Dodaj `mailbox_id uuid REFERENCES ade_mailboxes(id) ON DELETE CASCADE`
- Backfill z env-owej skrzynki systemowej → tworzę wiersz `owner_kind='system'` z placeholderami PEM (do wypełnienia; env pozostaje jako fallback w kroku 3), wszystkie istniejące wiadomości podpięte do niego
- Zmiana PK `edoreczenia_sync_state` z `mailbox_address` na `(mailbox_id, folder)`
- GRANTy + polityki RLS przez mailbox_id

### 2. Refaktor warstwy serwerowej

`src/lib/ade-client.server.ts`:
- `loadAdeConfig()` → `loadAdeConfigForMailbox(mailboxId)`; czyta wiersz z DB, deszyfruje PEM, zapisuje do tymczasowych plików (`/tmp/ade-<id>-cert.pem`) albo — lepiej — refaktor `httpsRawRequest` na przyjmowanie `cert`/`key` jako Buffer bezpośrednio zamiast ścieżek. Wybieram Buffer (czyściej).
- Wszystkie eksporty (`adeRawRequest`, `adeSeRawRequest`, `fetchAdeToken`, `buildClientAssertion`) przyjmują `mailboxId`.
- Fallback: gdy `mailboxId === 'env'` lub brak — używa dotychczasowych zmiennych env (skrzynka systemowa dla kompatybilności, do usunięcia po migracji).

`src/lib/ade-inbox.server.ts` i `src/lib/ade-inbox.functions.ts`:
- Wszystkie funkcje (`syncInbox`, `listDeliveries`, `getDelivery`, `sendMessage`, `saveDraft`, `searchBae`, `deleteMessage`, `downloadArchive`, `downloadEvidences`) przyjmują `mailboxId`.
- Autoryzacja: sprawdź czy user ma dostęp do tej skrzynki (własna user / członek org / admin systemu).

Nowe funkcje CRUD skrzynek (`src/lib/ade-mailboxes.functions.ts`):
- `listMyMailboxes(scope: {kind:'user'} | {kind:'org', orgId} | {kind:'system'})`
- `createMailbox(input)` — wgranie PEM + client_id + adres
- `updateMailbox(id, patch)`
- `deleteMailbox(id)`
- `testMailboxConnection(id)` — obecny test QWAC/mTLS/OAuth

### 3. Wspólny komponent UI

Przeniesienie:
- `src/components/settings/EdoreczeniaInboxTab.tsx` → `src/components/edoreczenia/EdoreczeniaInbox.tsx`
- Zmiana propsów: `{ scope: {kind:'user'} | {kind:'org', orgId} | {kind:'system'} }`; komponent sam listuje dostępne skrzynki (dropdown gdy >1), synchronizuje, wyświetla listę, foldery, szczegóły.
- `EdoreczeniaComposeDialog`, `EdoreczeniaBaeSearchDialog`, `AdeAddress` → `src/components/edoreczenia/`
- Wszystkie akcje przekazują `mailboxId`.

Nowy komponent konfiguracji:
- `src/components/edoreczenia/EdoreczeniaSetup.tsx` — lista skrzynek scope'u + formularz dodawania/edycji (upload cert.pem, key.pem, passphrase, client_id, mailbox_address, env, label) + przycisk „Testuj połączenie".

### 4. Osadzenie w trzech miejscach

- **Administracja → e-Doręczenia** (`src/routes/_authenticated.admin.edoreczenia.tsx`): zakładka „e-Doręczenia" renderuje `<EdoreczeniaInbox scope={{kind:'system'}} />`, zakładka „Integracja" renderuje `<EdoreczeniaSetup scope={{kind:'system'}} />` (zastępuje obecny hardcoded test env).
- **Korespondencja osobista** (`src/routes/_authenticated.correspondence.tsx`): zakładka „e-Doręczenia" renderuje `<EdoreczeniaInbox scope={{kind:'user'}} />`. Konfiguracja przez profil użytkownika.
- **Ustawienia użytkownika** (`src/routes/_authenticated.profile.tsx`): sekcja „e-Doręczenia" z `<EdoreczeniaSetup scope={{kind:'user'}} />`.
- **Organizacja → Korespondencja → e-Doręczenia**: nowa trasa `src/routes/_authenticated.organizations.$orgId.edoreczenia.tsx` renderująca `<EdoreczeniaInbox scope={{kind:'org', orgId}} />`; pozycja w `org-sidebar.tsx` pod „Autokorespondencja".
- **Profil organizacji** (`src/routes/_authenticated.organizations.$orgId.profile.tsx`): sekcja „e-Doręczenia" z `<EdoreczeniaSetup scope={{kind:'org', orgId}} />`.

### 5. Migracja obecnej skrzynki

- Podczas deploya migracja wstawia wiersz `owner_kind='system'` z pustymi PEM (nie da się odczytać PEM z pliku bez interakcji).
- Po deployu: super_admin otwiera Administracja → e-Doręczenia → Integracja → edytuje wygenerowany wiersz i wgrywa cert.pem/key.pem z VPS. Alternatywa: skrypt `vps/migrate-ade-to-db.mjs` który wczyta pliki z `/etc/ssl/concertivo/` i zaszyfruje do DB (użyję `EXT_PII_ENCRYPTION_KEY`). **Wybieram skrypt** — mniej klikania.
- `edoreczenia_deliveries.mailbox_id` UPDATE na id systemowej skrzynki, potem `ALTER COLUMN mailbox_id SET NOT NULL`.

### 6. Weryfikacja

- `bun run typecheck` / `vite build`
- Manualnie: administracja pokazuje istniejące wiadomości, konfiguracja pozwala dodać drugą skrzynkę user, user widzi ją w Korespondencji osobistej.

## Technical details

- Szyfrowanie PEM: użycie istniejącego `encryptPii` / `decryptPii` z `src/lib/crypto.server.ts` (AES-256-GCM, klucz `EXT_PII_ENCRYPTION_KEY` już w env VPS).
- Cache TLS agentów: `Map<mailboxId, https.Agent>` w module `ade-client.server.ts` żeby nie re-parsować PEM przy każdym requeście. Invalidate na update mailboxa.
- Klucz z passphrase: `crypto.createPrivateKey({ key, passphrase })`.
- `x5c` w JWT: liczony z PEM w pamięci, jak teraz.
- Foldery: `edoreczenia_sync_state` klucz `(mailbox_id, folder)`.

## Kolejność wykonania

1. Migracja SQL + zmiany typów Supabase (types.ts wygeneruje się automatycznie / dodam ręcznie).
2. Refaktor `ade-client.server.ts` na Buffer/mailboxId + cache.
3. Refaktor `ade-inbox.server.ts` + `.functions.ts` (mailboxId param + authz).
4. Nowy `ade-mailboxes.functions.ts` (CRUD + test).
5. Przeniesienie komponentów do `src/components/edoreczenia/` + prop `scope`.
6. `EdoreczeniaSetup.tsx` (formularz upload PEM).
7. Osadzenie w Administracji, Profilu Usera, Korespondencji osobistej, Profilu Org, nowej trasie org.
8. `org-sidebar.tsx` — link.
9. Skrypt migracyjny `vps/migrate-ade-to-db.mjs`.
10. Build + instrukcja deploya.

Dużo kodu — będę robił krokami, po każdym większym kroku napiszę co gotowe. Startuję od kroku 1 (migracja SQL) i 2 (`ade-client.server.ts` na Buffer + mailboxId).