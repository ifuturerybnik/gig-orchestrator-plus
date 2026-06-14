## Cel

W module Admin → Baza PP dodajemy trzy skanery uzupełniające braki w `public_entities` z publicznych źródeł:

- **BAE** (e-Doręczenia, gov.pl) → `edoreczenia_ade`, `regon`
- **GUS REGON BIR1.1** → `nip`, `regon`, adres pocztowy (ulica/nr/kod/miejscowość/gmina/powiat/województwo)
- **RSPO** (Rejestr Szkół, MEN) → `phone`, `email`, `www` dla osrodek_kultury który jest placówką oświatową

Każdy skaner jest osobnym przyciskiem w toolbarze Bazy PP, otwiera ten sam komponent dialogu z propozycjami i checkboxami akceptacji. Trafienia pewne (po REGON / NIP / dokładna nazwa+miejscowość) zaznaczone domyślnie; trafienia fuzzy widoczne ale niezaznaczone.

## Etapy

### Etap 1 — Skaner BAE (e-Doręczenia) ✓ niezależny, można puścić od razu

1. `src/lib/scanners/bae.server.ts` — pobiera `https://www.gov.pl/api/data/registers/search?pageId=21113705` (jeden GET, ~8.5 MB, 47k rekordów; pola: NAZWA_PODMIOTU, MIEJSCOWOSC, WOJEWODZTWO, REGON, ADE). Cache modułowy in-memory TTL 10 min.
2. Helpery `normalizeName()` (lower, usunięcie diakrytyków, usunięcie prefixów typu "urząd gminy w ", whitespace squeeze) i `normalizeCity()`.
3. Buduje 2 indeksy: `byRegon: Map<string, BaeRecord>`, `byNameCity: Map<string, BaeRecord[]>`.
4. `src/lib/scanners.functions.ts` → server fn `scanBaeMatches({ scope: 'selected'|'missing_ade', ids?: uuid[] })`. Zwraca `{ items: Array<{ entityId, current: {ade,regon,name,miejscowosc}, match?: {ade,regon,confidence:'exact_regon'|'exact_name_city'|'fuzzy', source: BaeRecord}, candidates?: BaeRecord[] }> }`.
5. Server fn `applyScannerUpdates({ updates: Array<{ id, patch: Partial<EntityFields> }>, source: 'bae' })` — bulk update, używa `updatePublicEntity` (pojedyncze) w pętli z chunkowaniem. Admin only.

### Etap 2 — Wspólny UI dialogu skanera

1. `src/components/baza-pp/ScannerDialog.tsx` — reusable, props: `{ open, source: 'bae'|'gus'|'rspo', scope, selectedIds, onClose }`.
2. Stany: idle → scanning (progress) → results (tabela: nazwa | miejscowość | aktualne wartości | znalezione wartości | poziom dopasowania badge | checkbox „zastosuj") → applying → done (raport: X zaktualizowanych / Y pominiętych / Z błędów).
3. Toolbar Bazy PP: dropdown "Skanuj zewnętrzne źródła" z trzema opcjami; wewnątrz każdy wybór scope (selected | missing target field).
4. i18n keys `scannerBae*`, `scannerGus*`, `scannerRspo*` w pl.ts/en.ts.

### Etap 3 — Skaner RSPO

1. `src/lib/scanners/rspo.server.ts` — REST `https://api-rspo.mein.gov.pl/api/placowki/?...` (paginowany, bez klucza). Cache modułowy.
2. Match po nazwie+miejscowości (RSPO ma `nazwa`, `miejscowosc`, `wojewodztwo`, `kodPocztowy`, `ulica`, `numerBudynku`, `telefon`, `email`, `stronaInternetowa`, `regon`, `nip`).
3. Server fn `scanRspoMatches(...)` — analogicznie do BAE. Wyniki: telefon/email/www/nip/regon + adres (jeśli brakuje).

### Etap 4 — Skaner GUS REGON BIR1.1 (wymaga klucza)

1. User rejestruje się w `api.stat.gov.pl` (instrukcja w UI — link + krótki opis). Klucz przesyła nam wraz z prośbą o `add_secret EXT_GUS_BIR_KEY`.
2. `src/lib/scanners/gus.server.ts` — SOAP/JSON klient BIR1.1: zaloguj (`Zaloguj` → sid), `DaneSzukajPodmioty` po REGON lub NIP lub krs. Sesja sid cache w pamięci TTL 50 min (GUS daje 60).
3. Jeśli mamy regon/nip → strzelamy po nim (high confidence). Jeśli nie → po nazwie + miejscowości (low conf, fuzzy).
4. Wyciągamy adres + nip + regon + datę rejestracji + formę prawną → patch.

### Etap 5 — Migracja DB (jedna, drobna)

`supabase/migrations/0064_public_entities_scan_audit.sql` — opcjonalna tabela `public_entities_scan_log(id, scanned_at, source, entity_id, action, before jsonb, after jsonb, by_user)` dla audytu. RLS: tylko admin. Można też pominąć i log trzymać tylko w UI.

## Szczegóły techniczne

- Wszystkie server fn z `requireSupabaseAuth` + `assertAppAdmin(supabase, userId, true)` (super_admin lub admin_staff).
- BAE i RSPO bez kluczy → fetch z `process.env`-less. GUS wymaga `EXT_GUS_BIR_KEY` (add_secret po Etapie 3).
- Cache: prosty obiekt na module-level w `*.server.ts`, klucz = endpoint, value = `{ data, fetchedAt }`. Worker stateless ale per-instance trzyma kilka minut, w pełni wystarczy.
- Normalizacja nazw: `nfd` → strip combining marks → lower → usuń prefixy regexem (`/^(urząd|urzad|gminny|miejski|powiatowy|...) +/`).
- UI: do każdej propozycji badge `Pewne` (zielony) / `Propozycja` (żółty). Sortowanie wg confidence DESC.
- Limity: skan w paczkach po 500 rekordów (pętla po stronie serwera), `applyScannerUpdates` chunki po 200.
- Brak rate-limit od strony backendu — to skaner adminowski, używany ad-hoc.

## Ryzyka / nie-cele

- BAE endpoint to API niepubliczne (XHR strony gov.pl). Brak SLA, nazwa pola/URL mogą się zmienić — łatwy fix (jedna funkcja).
- GUS BIR1.1 to SOAP — relatywnie ciężki klient, ale w Workerze działa (fetch + ręczny XML build).
- Nie scrapujemy stron BIP. Nie ruszamy KRS (na razie).
- Cron / automatyczne uruchamianie poza zakresem.
