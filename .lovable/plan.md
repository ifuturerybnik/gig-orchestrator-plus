
# Plan startowy projektu Concertivo

## Założenia ogólne

- **Workspace**: projekt zakładasz w UI Lovable, wybierając workspace "CRM Hub" (po mojej stronie nie ma akcji).
- **Hosting**: development na Lovable + GitHub sync od pierwszego dnia. Stack (TanStack Start) działa na Node 20+, więc migracja na Hostinger VPS = `git pull` + `bun install` + `bun run build` + uruchomienie pod PM2/systemd za nginx.
- **Baza danych**: **wyłącznie zewnętrzny Supabase**, który już posiadasz. Lovable Cloud pozostaje wyłączone — zapiszę to jako twardą regułę w pamięci projektu, żeby nigdy nie próbować provisionować nowego Supabase.
- **Domena z Aftermarket**: podłączymy ją do Lovable po pierwszym publish (Project Settings → Domains → Connect Domain, rekordy A 185.158.133.1 + TXT `_lovable`). Przy migracji na Hostinger zmienisz DNS na IP VPS.

## Krok 1: Konfiguracja połączenia z zewnętrznym Supabase

Dodam do projektu secrety (poproszę Cię o wartości przez bezpieczny formularz):

- `VITE_SUPABASE_URL` — publiczny URL Twojego projektu Supabase
- `VITE_SUPABASE_PUBLISHABLE_KEY` — anon/publishable key
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` — te same wartości, ale dla runtime serwera
- `SUPABASE_SERVICE_ROLE_KEY` — service role (tylko serwer, nigdy w bundlerze klienta)

Stworzę trzy klienty zgodnie z konwencją TanStack Start:
- `src/integrations/supabase/client.ts` — przeglądarka (publishable key, sesja użytkownika)
- `src/integrations/supabase/auth-middleware.ts` — middleware do server functions
- `src/integrations/supabase/client.server.ts` — admin (service role, tylko po stronie serwera)

## Krok 2: Schemat bazy danych (migracje SQL po Twojej stronie Supabase)

Przygotuję pliki migracji SQL, które Ty wykonasz w panelu Supabase (Lovable nie zarządza zewnętrznym Supabase automatycznie). Tabele:

- `profiles` — dane użytkownika, FK do `auth.users`, kolumna `user_kind[]` (wielokrotny wybór tożsamości)
- `user_kinds` (enum/słownik): `team_manager`, `musician`, `sound_engineer`, `lighting_engineer`, `visual_engineer`, `driver`, `stage_technician`, `stage_company_owner`, `event_company_owner`, `concert_organizer`
- `app_role` (enum): `super_admin`, `admin_staff`, `user`
- `user_roles` — globalne role systemowe (admin i jego pracownicy), osobna tabela żeby uniknąć rekurencji RLS
- `organizations` — zespoły muzyczne / firmy estradowe / firmy eventowe, `type`, `name`, `status` (`pending` / `approved` / `rejected`), `created_by`, `approved_by`, `approved_at`
- `organization_members` — łączenie użytkowników z organizacjami + rola w organizacji (`owner`, `member`)
- `organization_invitations` — zaproszenia mailowe, `email`, `token`, `expires_at`, `status`

Plus funkcje SECURITY DEFINER:
- `public.has_role(_user_id, _role)`
- `public.is_member_of(_user_id, _org_id)`
- `public.is_owner_of(_user_id, _org_id)`

RLS włączone na wszystkich tabelach z politykami opartymi na powyższych funkcjach (nigdy nie zapytaniami do tej samej tabeli).

## Krok 3: Autentykacja i rejestracja

- Email/hasło + Google (przez broker Lovable). Reset hasła z dedykowaną stroną `/reset-password`.
- Flow rejestracji wieloetapowy:
  1. Email + hasło
  2. Imię, nazwisko, telefon
  3. Wybór jednej lub wielu tożsamości z listy `user_kinds`
  4. Po potwierdzeniu maila → dashboard z opcją "Zarejestruj zespół/firmę"
- Trigger SQL `on_auth_user_created` automatycznie tworzy rekord w `profiles`.
- Strona `/admin/approvals` widoczna tylko dla `super_admin` i `admin_staff` — lista organizacji ze statusem `pending`, przyciski Zatwierdź/Odrzuć.
- Po zatwierdzeniu organizacji jej `owner` widzi przycisk "Zaproś użytkownika" (formularz z emailem, generuje token, wysyła mail).

## Krok 4: Internacjonalizacja (i18n)

- Biblioteki: `i18next`, `react-i18next`, `i18next-browser-languagedetector`.
- Struktura: `src/locales/pl/common.json`, `src/locales/en/common.json` (per moduł: `common`, `auth`, `organizations`, `admin`...).
- Auto-detect z `navigator.language` → fallback `pl`. Wybór języka w nagłówku zapisuje preferencję w `localStorage` i w `profiles.preferred_language`.
- Wszystkie napisy w UI od początku przez `t('key')` — żadnych hardkodowanych stringów. Dodanie nowego języka = dorzucenie folderu `src/locales/<lang>/`.

## Krok 5: Architektura routingu (TanStack Start)

```
src/routes/
  __root.tsx           — shell, providers (QueryClient, i18n)
  index.tsx            — landing publiczny (PL/EN)
  login.tsx
  register.tsx
  reset-password.tsx
  _authenticated.tsx                       — gate auth
    dashboard.tsx
    organizations.index.tsx                — moje organizacje
    organizations.new.tsx                  — rejestracja zespołu/firmy
    organizations.$orgId.tsx               — szczegóły, członkowie, zaproszenia
    _admin.tsx                             — gate role admin
      admin.approvals.tsx
      admin.users.tsx
      admin.organizations.tsx
```

## Krok 6: Design system

Minimalny, neutralny start — tokeny w `src/styles.css` (kolory `oklch`, typografia, radius). Bez angażowania `design--create_directions` na tym etapie, bo to przede wszystkim setup. Konkretne kierunki wizualne zaproponuję w osobnym kroku, gdy będziemy budować pierwsze widoki.

## Krok 7: GitHub sync + pierwszy publish

- Po zbudowaniu szkieletu poproszę Cię o podłączenie GitHub (Plus → GitHub → Connect project), żeby repo było żywe od początku.
- Pierwszy publish na `*.lovable.app`, potem podpięcie domeny z Aftermarket.

---

## Szczegóły techniczne (dla mnie / do referencji)

- Nie używamy Lovable Cloud ani `supabase--enable`. Wszystkie operacje DB idą do zewnętrznego Supabase — schemat tworzysz Ty wykonując dostarczone migracje SQL.
- Server functions (`createServerFn`) zamiast Supabase Edge Functions dla logiki aplikacji. Edge Functions tylko do webhooków, gdy zajdzie potrzeba.
- Wymagana globalna `attachSupabaseAuth` w `src/start.ts` (middleware dopinający Bearer token do każdego wywołania server fn).
- `onAuthStateChange` raz w `__root.tsx` → `router.invalidate()` + `queryClient.invalidateQueries()` przy każdej zmianie sesji.
- Pamięć projektu (`mem://index.md`) dostanie regułę: "Use external Supabase only. Never enable Lovable Cloud. Credentials in secrets: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY."

## Co dostarczam w pierwszej iteracji (po akceptacji planu)

1. Setup secretów (poproszę o wartości z Twojego Supabase).
2. Klienty Supabase + middleware auth + i18n bootstrap.
3. Plik SQL z całym schematem + RLS + funkcjami + triggerami — do uruchomienia w Twoim panelu Supabase.
4. Routing: landing, login, register (multi-step), reset hasła, dashboard, rejestracja organizacji, panel adminowy do zatwierdzania, zaproszenia mailowe.
5. Memory rule dot. zewnętrznego Supabase.

Kolejne moduły (kalendarz koncertów, riderzy, kontrakty, rozliczenia, CRM klientów, ekipa techniczna) dorzucamy iteracyjnie — w osobnych zleceniach, każdy jako mały, spójny krok.
