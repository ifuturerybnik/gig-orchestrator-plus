# Plan: Cloudflare R2 — Model 2 + Model 3 z kwotami i integracją per-organizacja

## Cel

Każda organizacja ma jedno z dwóch źródeł storage:

- **Model 2 (default)** — centralny bucket Concertivo na R2. Free quota (np. 2 GB) + płatne dodatkowe GB. Super admin może per-org przyznać większy darmowy limit.
- **Model 3 (opt-in)** — organizacja podpina własne konto Cloudflare R2 (account_id + access/secret key + bucket + public base url). Wtedy nasze limity i rozliczenia jej nie dotyczą.

Wybór jest per-organizacja, przełączalny w profilu org.

## Architektura

```text
[Browser] --presigned PUT/GET--> [R2 bucket: central LUB own]
    |
    | metadata only (key, size, mime, url)
    v
[Supabase DB]  <-- usage rollup (sumy per-org)

[Server fn r2.presign]
  - reads org_storage_config (mode = central | own)
  - central: uses EXT_R2_* + sprawdza quotę (free + bonus + paid) → throw 413 jeśli przekroczono
  - own:     dekoduje klucze org (AES-256-GCM, EXT_PII_ENCRYPTION_KEY) → signer S3 dla endpointu org
  - zwraca { uploadUrl, publicUrl, key, expiresIn }
```

Wszyscy klienci (Aktualności, Galeria, Wydarzenia, później AI Studio media) używają tej samej abstrakcji `presignUpload({ orgId, contentType, size, folder })` / `deleteObject({ orgId, key })`.

## Zmiany w DB (nowa migracja `supabase/migrations/0022_storage_r2.sql`)

1. `storage_global_config` (singleton, max 1 wiersz, id=1)
   - `free_quota_gb numeric default 2`
   - `price_per_extra_gb_cents int default 0` (np. 5 ct / GB / mies., na razie tylko zapis)
   - `central_enabled bool default true`
   - `updated_at`, `updated_by`
2. `org_storage_config` (per org_id, PK = org_id)
   - `mode text check in ('central','own') default 'central'`
   - `bonus_free_gb numeric default 0` ← niezależne przyznawanie darmowego dostępu
   - `paid_extra_gb numeric default 0` ← opcjonalna ręczna nadwyżka (na razie zapis ręczny)
   - Pola dla Model 3 (szyfrowane):
     - `r2_account_id text`
     - `r2_access_key_id_enc text`
     - `r2_secret_access_key_enc text`
     - `r2_bucket text`
     - `r2_endpoint text` (np. `https://<acct>.r2.cloudflarestorage.com`)
     - `r2_public_base_url text` (CDN / r2.dev / własna domena)
   - `created_at`, `updated_at`
3. `org_storage_objects`
   - `id uuid pk`, `org_id uuid not null`, `mode text`, `bucket text`, `key text`, `size_bytes bigint`, `mime text`, `module text` (aktualnosci/galeria/...), `entity_id uuid null`, `public_url text`, `created_by uuid`, `created_at`
   - index po (org_id, module), (org_id, created_at desc)
4. `org_storage_usage` widok / materialized: suma `size_bytes` per org gdzie `mode='central'`.
5. RLS:
   - `storage_global_config`: select dla authenticated, write tylko `super_admin` (via `has_role`).
   - `org_storage_config`: select dla członków org, write dla `org_admin` (mode/własne klucze) + super_admin (bonus_free_gb/paid_extra_gb).
   - `org_storage_objects`: select dla członków org, insert/delete dla członków org (przez server fn z service role i tak walidujemy).
6. GRANTy zgodnie z konwencją (authenticated + service_role).

## Sekrety (runtime — Lovable secrets)

- `EXT_R2_ACCOUNT_ID`
- `EXT_R2_ACCESS_KEY_ID`
- `EXT_R2_SECRET_ACCESS_KEY`
- `EXT_R2_BUCKET`
- `EXT_R2_PUBLIC_BASE_URL` (np. `https://media.concertivo.eu` lub `https://pub-xxx.r2.dev`)

(prefiks `EXT_` bo Lovable rezerwuje `SUPABASE_`/`R2_` może być wolne, ale trzymamy konwencję projektu).

Poprosimy o nie po akceptacji planu.

## Backend (server functions)

`src/lib/storage-r2.server.ts` — helpery:

- `getOrgStorageContext(orgId)` → `{ mode, signer, bucket, publicBaseUrl, quotaBytes?, usedBytes? }`
- `presignPut({ orgId, key, contentType, contentLength })` — używa `@aws-sdk/s3-request-presigner` (R2 = S3-compatible)
- `deleteObject({ orgId, key })`
- `calculateQuota(orgId)` → `{ freeGb, bonusGb, paidGb, totalGb, usedBytes, remainingBytes }`

`src/lib/storage.functions.ts` — server fns:

- `getStorageGlobalConfig` / `updateStorageGlobalConfig` (super_admin)
- `getOrgStorageConfig(orgId)` / `updateOrgStorageMode(orgId, mode)` (org_admin)
- `setOrgOwnR2(orgId, { accountId, accessKeyId, secretAccessKey, bucket, endpoint, publicBaseUrl })` — szyfruje klucze (`encryptPii`) i zapisuje (org_admin)
- `testOrgOwnR2(orgId)` — testowy PUT/DELETE pliku `.concertivo-test`
- `clearOrgOwnR2(orgId)` (org_admin)
- `grantOrgStorageBonus(orgId, { bonus_free_gb, paid_extra_gb, note })` — TYLKO super_admin
- `getOrgStorageUsage(orgId)` — zwraca quotę + zużycie
- `presignOrgUpload({ orgId, module, fileName, contentType, contentLength })` — sprawdza quotę (central) lub robi presign do własnego R2; rejestruje rekord w `org_storage_objects` po sukcesie (osobny `confirmOrgUpload`)
- `confirmOrgUpload({ uploadId, sizeBytes })` — zapisuje finalny rekord
- `deleteOrgObject(objectId)`

Wszystko z `requireSupabaseAuth`. Walidacja zod, limit rozmiaru per request (np. 50 MB image, 200 MB video — konfigurowalne).

## UI

### A. Admin → nowa zakładka „Storage" (`/admin/storage`)

`src/routes/_authenticated.admin.storage.tsx` + entry w `src/components/` w `_authenticated.admin.tsx` sidebar (ikona `HardDrive`).

Sekcje:

1. **Konfiguracja globalna R2** (super_admin)
   - status sekretów (✅/❌ obecność `EXT_R2_*`)
   - free quota (GB) — input numeryczny
   - cena za 1 GB nadwyżki (PLN/mies.) — input
   - przełącznik „central_enabled" (gdy off — nowe orgi muszą podać własne R2)
2. **Organizacje — kwoty i bonusy**
   - tabela: nazwa org | tryb (central/own) | użyto | free | bonus | paid | razem | akcje
   - akcja „Przyznaj bonus" → dialog `bonus_free_gb`, `paid_extra_gb`, `note` → `grantOrgStorageBonus`
   - filtr/search po nazwie

### B. Profil organizacji → nowa sekcja „Storage"

Dodanie w `_authenticated.organizations.$orgId.profile.tsx` (lub sub-tab) komponentu `<OrgStorageSection orgId={...} />`:

- Karta „Tryb storage":
  - radio: `Concertivo Storage (centralny)` | `Własne Cloudflare R2`
  - przy `central`: pokazujemy quotę i zużycie + progress bar; przy >80% komunikat o płatnym/własnym R2
  - przy `own`: formularz (account_id, access_key_id, secret_access_key [password input], bucket, endpoint, public_base_url) + przycisk „Testuj połączenie" + „Zapisz" + „Wyczyść"
- Tekst pomocy z linkiem do docs Cloudflare (jak utworzyć bucket + API token z permisją Object Read+Write).

### C. i18n

Nowe klucze w `src/locales/pl.ts` + `en.ts` pod gałęziami:

- `admin.nav.storage`, `admin.storage.*`
- `organizations.storage.*`

## Implementacja w turach

Buduję w jednej turze całość backendu + admin UI + sekcja w profilu org. Bez podpinania jeszcze do Aktualności (to kolejna tura — Aktualności użyją `presignOrgUpload`).

Kolejność plików w tej turze:

1. `supabase/migrations/0022_storage_r2.sql`
2. `bun add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
3. `src/lib/storage-r2.server.ts` + `src/lib/storage.functions.ts`
4. `src/routes/_authenticated.admin.storage.tsx` + wpis w sidebar admin
5. `src/components/organizations/OrgStorageSection.tsx` + wpięcie w `profile.tsx`
6. i18n (pl/en)

## Po akceptacji potrzebuję od Ciebie

1. Założenie bucketa R2 (np. `concertivo-media`) i API tokena R2 z permisją Object Read & Write.
2. Wgranie sekretów `EXT_R2_*` (odpalę `add_secret` zaraz po Twoim OK).
3. Wykonanie migracji `0022_storage_r2.sql` w panelu Supabase.

Po tym przejdziemy do podpięcia uploadu w module **Aktualności** (Tura następna).

## Otwarte pytania (potwierdź, lecę z domyślnymi jeśli nic nie napiszesz)

- Domyślny free limit: **2 GB** ✓
- Domyślna cena za 1 GB nadwyżki: **0,25 PLN/mies.** (zapis pola, brak billingu na razie) ✓
- Maks. rozmiar pojedynczego pliku: **50 MB obraz / 200 MB wideo** ✓
- Public URL: dla centralnego użyjemy `EXT_R2_PUBLIC_BASE_URL/{key}`; dla own — `r2_public_base_url/{key}` (klient sam dba o publiczny dostęp/CDN/r2.dev).
