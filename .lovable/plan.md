
## Co dorobię

### 1. Kolumna „Gmina" w Bazie PP
- Migracja `0065_public_entities_gmina.sql`: `ALTER TABLE public.public_entities ADD COLUMN gmina text;`
- `src/lib/public-entities.functions.ts`: dodaję `gmina` do `entitySchema` i `SELECT_COLS`.
- `src/routes/_authenticated.admin.baza-pp.tsx`: kolumna w tabeli, w filtrach „brakujące", w formularzu edycji/dodawania, w eksporcie CSV/XLSX i imporcie.
- i18n (pl/en): klucz `admin.bazaPp.cols.gmina` itd.

### 2. Skaner „GUS REGON – BIR1.1" – tryb interaktywny + tło

Dwa kroki UI w nowym dialogu `GusScanDialog`:
1. **Skanuj po** – radio: `NIP | REGON | KRS` (jeden identyfikator na wpis – jeśli rekord nie ma wybranego identyfikatora, jest pomijany i raportowany jako „brak źródła").
2. **Uzupełnij** – checkboxy pól, które mają być porównane/uzupełnione:
   `NIP, REGON, KRS, Nazwa, Województwo, Powiat, Gmina, Miejscowość, Kod poczt., Poczta, Ulica, Nr domu`.

Po „Start":
- Tworzy się rekord w tabeli `gus_scan_jobs` (zlecenie do tła).
- Dialog pokazuje live progress (postęp + log + lista poprawek na żywo) – odświeżany co 2 s server fn `getGusScanJob`.
- Można zamknąć przeglądarkę / wylogować się – job leci dalej w tle (worker `/api/public/gus-scan-tick`).
- Po zakończeniu dialog (lub strona „Moje skany GUS") pokazuje raport: ile rekordów sprawdzono / poprawiono / pominięto + szczegółowa lista zmian (przed → po dla każdego pola).
- Przycisk **Pobierz raport PDF** (jsPDF, już w deps).

### 3. Rate-limit ≤ 1 zapytanie/sek do GUS
Już istnieje (`throttleSoap()` w `src/lib/gus.functions.ts`, `MIN_GAP_MS = 1000`). Worker tick wywołuje wspólny helper, więc limit jest globalny dla procesu serwera. Dodatkowo w workerze: 1 rekord = 1 zapytanie SOAP (sesja cache'owana, scope=basic dla podstawowych pól, full tylko gdy zaznaczone Powiat/Gmina, których nie ma w `DaneSzukajPodmioty`).

### 4. Schemat DB (migracja `0066_gus_scan_jobs.sql`)

```sql
create table public.gus_scan_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  identifier text not null check (identifier in ('nip','regon','krs')),
  fields text[] not null,                 -- które pola uzupełniać
  entity_ids uuid[] not null,             -- lista do przetworzenia
  status text not null default 'queued',  -- queued|running|done|cancelled|error
  total int not null default 0,
  processed int not null default 0,
  updated_count int not null default 0,
  skipped_count int not null default 0,
  error_count int not null default 0,
  current_entity_id uuid,
  last_error text,
  changes jsonb not null default '[]'::jsonb, -- [{entity_id,name,changes:{field:{from,to}}}]
  log jsonb not null default '[]'::jsonb,     -- [{ts,level,text}]
  created_at timestamptz default now(),
  started_at timestamptz,
  finished_at timestamptz
);
grant select, insert, update on public.gus_scan_jobs to authenticated;
grant all on public.gus_scan_jobs to service_role;
alter table public.gus_scan_jobs enable row level security;
create policy "own jobs read" on public.gus_scan_jobs for select to authenticated using (created_by = auth.uid() or public.has_role(auth.uid(),'super_admin'));
create policy "own jobs insert" on public.gus_scan_jobs for insert to authenticated with check (created_by = auth.uid());
create policy "own jobs update" on public.gus_scan_jobs for update to authenticated using (created_by = auth.uid());
```

### 5. Server functions (`src/lib/gus-scan.functions.ts`)
- `startGusScanJob({ identifier, fields, scope:'selected'|'missing_target', ids })` – tworzy zlecenie, zwraca `jobId`.
- `getGusScanJob({ jobId })` – status + log + changes (do live podglądu).
- `cancelGusScanJob({ jobId })` – ustawia status `cancelled`.

### 6. Worker cron (`src/routes/api/public/gus-scan-tick.ts`)
- Wymagany `X-Cron-Secret = CRON_SECRET`.
- Pobiera `queued`/`running` joby, dla każdego przetwarza max N rekordów na tick (limit czasu workera). Każdy rekord:
  1. odczytuje `public_entities`,
  2. woła `gusLookup` (basic albo full wg `fields`),
  3. liczy `patch` tylko dla pól zaznaczonych w `fields` i tylko gdy wartość się różni / jest pusta,
  4. zapisuje update + appenduje wpisy do `changes` i `log`,
  5. zwiększa liczniki, ustawia `processed`, `current_entity_id`.
- Gdy `processed = total` → `status=done`, `finished_at`.

Tick muszę uruchamiać co 30 s. Dodam wpis pg_cron w migracji `0066`:
```sql
select cron.schedule('gus-scan-tick','*/1 * * * *',
  $$ select net.http_post(url:='https://concertivo.eu/api/public/gus-scan-tick',
       headers:=jsonb_build_object('x-cron-secret', current_setting('app.cron_secret', true)),
       body:='{}'::jsonb) $$);
```
(jeśli `app.cron_secret` nie jest ustawiony, użytkownik dostanie instrukcję ręcznego `ALTER DATABASE ... SET app.cron_secret = '...'`).

### 7. Raport PDF
`src/lib/gus-scan-report.ts` (client) – jsPDF + autotable:
- nagłówek (data, kto, identifier, liczba rekordów),
- tabela: nazwa, ID, wynik (updated / skipped / error),
- sekcja „zmiany": dla każdego rekordu pole | przed | po.

### 8. Punkty wpięcia w UI
W `_authenticated.admin.baza-pp.tsx`: zamiast otwierać `ScannerDialog` dla `gus`, otwieram nowy `GusScanDialog`. Pozostałe źródła (BAE/RSPO) działają jak dotąd.

Dodam też w sidebarze sekcji admin podstronę `/_authenticated/admin/baza-pp/gus-jobs` (lista moich zleceń – status + raport PDF), żeby użytkownik mógł wrócić po wylogowaniu.

## Czego NIE zmieniam
- BAE/RSPO – bez zmian.
- Istniejący `scanGusMatches` w `scanners.functions.ts` usuwam tylko miejsce wywołania (placeholder), funkcja zostaje albo zwraca przekierowanie do nowego flow.
- Limit 1 req/s jest globalny w procesie – jeśli będzie kilka równoległych jobów, dzielą się tą samą kolejką (akceptowalne).

## Pytania zanim ruszę
1. **PDF**: użyjemy `jspdf` (już zainstalowany) + dorzucę `jspdf-autotable` (~50 kB). OK?
2. **Cron**: czy mam w migracji od razu zaplanować `cron.schedule(...)` w pg_cron (tak jak autokorespondencja), czy zostawić instrukcję do ręcznego uruchomienia na VPS / Supabase?
3. **Pole „Gmina"**: czy chcesz, żeby było widoczne we WSZYSTKICH typach (gmina/powiat/wojewodztwo/osrodek_kultury), czy tylko dla `jst_gmina`?
