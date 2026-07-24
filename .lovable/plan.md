Cel: wdrożyć pierwszy moduł e-Doręczeń — odbiór przesyłek z ADE (UA API v.3) w panelu Administracja → e-Doręczenia, z powiadomieniami o nowych doręczeniach.

## Zakres

1. **Schemat bazy danych**
   - Tabela `public.edoreczenia_deliveries` do przechowywania odebranych przesyłek.
   - Tabela `public.edoreczenia_sync_state` (ostatni czas synchronizacji, cursor, status).
   - Tabela `public.edoreczenia_notifications` (powiadomienia dla użytkowników o nowych przesyłkach).
   - Wymagane GRANTy, RLS, polityki dla `authenticated` / `service_role`.
   - Rola `admin_staff` / `super_admin` ma pełen dostęp; zwykli użytkownicy nie mają dostępu.

2. **Warstwa serwerowa**
   - Rozszerzenie `src/lib/ade-client.server.ts` o endpointy listowania przesyłek UA API v.3 (np. `GET /api/v1/mailbox/deliveries`, szczegóły przesyłki).
   - Nowe funkcje serwerowe w `src/lib/edoreczenia.functions.ts`:
     - `syncAdeDeliveries()` — pobiera nowe przesyłki z ADE, zapisuje do bazy, generuje powiadomienia.
     - `listAdeDeliveries()` — lista odebranych z bazy z paginacją i filtrami.
     - `getAdeDeliveryDetails()` — szczegóły przesyłki.
     - `markDeliveryAsRead()` — oznaczenie jako przeczytanej.
   - Sprawdzanie uprawnień admina przez `has_role` / `user_roles`.

3. **Powiadomienia**
   - Wykorzystanie istniejącego systemu powiadomień (`notifications` + `app-events-badge` / `useNotifications`).
   - Podczas `syncAdeDeliveries` dla każdej nowej przesyłki tworzymy rekord powiadomienia dla wszystkich administratorów z uprawnieniem do e-Doręczeń.

4. **Interfejs użytkownika**
   - Rozbudowa `src/components/settings/IntegracjaEdoreczeniaTab.tsx` o zakładki:
     - „Połączenie” (obecny test).
     - „Odebrane” — lista przesyłek z kolumnami: nadawca, temat, data, status, przeczytana.
     - „Szczegóły przesyłki” — modal/drawer z treścią i metadanymi.
   - Przycisk „Synchronizuj z ADE” z loaderem i raportem ile nowych przesyłek pobrano.
   - Badge „e-Doręczenia” w panelu administracyjnym pokazujący liczbę nieprzeczytanych.

5. **Integracja z nawigacją**
   - Pozycja „e-Doręczenia” w side-barze administracyjnym (`src/routes/_authenticated.admin.tsx`) z badge'm nieprzeczytanych.
   - Trasa `/admin/edoreczenia` pozostaje bez zmian, komponent z zakładkami.

6. **SEO / metadane**
   - `head()` w `src/routes/_authenticated.admin.edoreczenia.tsx` zaktualizowany o pełne meta (title, description, og, twitter).

7. **Testy i weryfikacja**
   - Lokalne budowanie (`vite build`) bez błędów.
   - Podgląd zakładki „e-Doręczenia” w panelu admina.
   - Instrukcja deploy na VPS (`git pull`, `bunx vite build --config vite.vps.config.ts`, `pm2 restart`).
   - Uwaga: faktyczny test pobierania przesyłek z ADE wymaga środowiska VPS (Node + certyfikaty QWAC); w podglądzie Lovable panel pokaże stan „oczekuje na VPS” lub dane testowe.

## Technical details

- `ade-client.server.ts` używa `node:https`, `node:fs`, `node:crypto` — kod działa tylko na VPS Node runtime, nie w Cloudflare Worker (podgląd Lovable).
- Wszystkie funkcje serwerowe z `requireSupabaseAuth` i weryfikacją ról admina.
- Szczegóły UA API v.3 (ścieżki, nazewnictwo pól, paginacja) zostaną dopasowane po konsultacji dokumentacji Ministerstwa Cyfryzacji / Poczty Polskiej; do kodu wstawiamy konfigurowalne `ADE_*` z fallbackami.

## Kolejne kroki po zatwierdzeniu planu

1. Migracja bazy (tabele + GRANTy + RLS).
2. Kod serwerowy ADE (listowanie, synchronizacja, powiadomienia).
3. UI z zakładkami i listą przesyłek.
4. Badge w side-barze admina.
5. Build + deploy + instrukcja testu na VPS.