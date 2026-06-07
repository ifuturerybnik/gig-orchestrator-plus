# Moduły sidebaru organizacji

Lista głównych pozycji w sidebarze (`src/lib/org-modules.ts`). Każda
może być wyłączona dla konkretnego członka organizacji w dialogu
„Uprawnienia członka" (admin organizacji).

## Przegląd (`overview`)

Strona startowa organizacji — skrót najważniejszych liczb (najbliższe
koncerty, otwarte korespondencje, ostatnia aktywność). Zawsze widoczna.

## Wydarzenia (`events`)

Lista koncertów i wydarzeń organizacji. Tryby uprawnień:

- `full` — pełna edycja,
- `view_only` — tylko podgląd,
- `view_confirmed_only` — tylko potwierdzone wydarzenia.

Pole `status` koncertu: `draft`, `confirmed`, `cancelled`, `done`.

## Budżet (`budget`)

Pozycje przychodów i kosztów koncertu. Tryby:

- `full` — widzi też zrealizowane wpłaty/wypłaty,
- `unrealized_only` — tylko plan (bez kwot zrealizowanych).

## Profil (`profile`)

Dane organizacji: nazwa, NIP, adres, opis, gatunki, dane do faktury.
Zawsze widoczny.

## Kontakty (`contacts`)

Hybrydowa baza kontaktów (`person` / `company` / `artist`) — wspólny
moduł dla każdego typu organizacji. Zapis może być prywatny (`user`)
lub współdzielony w organizacji (`org`).

## Kontrahenci (`counterparties`)

Współdzielona baza firm/instytucji między organizacjami
(`organizations.is_shared = true`). Claim własności wymaga akceptacji
admina Concertivo.

## Poczta (`mail`) — grupa: Korespondencja

Globalny moduł e-mail (IMAP/SMTP + tracking). Skrzynki, szablony,
wysyłka, śledzenie otwarć. Działa identycznie dla każdej organizacji.

## Autokorespondencja (`autokorespondencja`) — grupa: Korespondencja

Scenariusze automatycznej wysyłki maili (np. po dodaniu kontaktu, po
zakończeniu koncertu).

## AI Studio (`ai_studio`) — grupa: Media & Web

Generator postów / grafik / opisów. Tryby:

- `full`, `create_only`, `moderation_only`, `view_only`.

## Social Media (`social`) — grupa: Media & Web

Integracja z Facebook, Instagram, YouTube, TikTok, X. Konfiguracja kont,
publikacja, statystyki.

## Web (`web`) — grupa: Media & Web

Strona internetowa organizacji generowana z danych Concertivo.

## Dysk (`dysk`)

Pliki organizacji (rider, plakat, kontrakt, faktura). Storage Supabase.

## Członkowie (`members`)

Zarządzanie członkami organizacji, zaproszenia, edycja uprawnień.
Widoczne tylko dla admina organizacji.
