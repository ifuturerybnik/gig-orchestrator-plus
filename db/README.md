# Migracje bazy danych Concertivo

## Jak uruchomić

Te migracje wykonujesz **ręcznie** w panelu zewnętrznego Supabase, ponieważ Lovable nie zarządza tą bazą.

1. Wejdź na [supabase.com/dashboard](https://supabase.com/dashboard) → Twój projekt
2. Lewe menu → **SQL Editor** → **New query**
3. Otwórz odpowiedni plik `.sql` z tego folderu (np. `0001_init.sql`)
4. Skopiuj **całą** zawartość i wklej do edytora
5. Kliknij **Run**

Wszystkie migracje są **idempotentne** — można je uruchomić wielokrotnie bezpiecznie. Robiąc kolejne uruchomienia po wprowadzeniu zmian w pliku otrzymasz tylko `CREATE OR REPLACE`/`IF NOT EXISTS`.

## Kolejność

Uruchamiaj migracje w kolejności numerycznej. Każda kolejna zakłada, że poprzednie zostały już wykonane.

## Po pierwszej migracji

Po wykonaniu `0001_init.sql` i pierwszej rejestracji użytkownika w aplikacji, nadaj sobie rolę `super_admin` — instrukcja znajduje się na końcu pliku `0001_init.sql` w sekcji `BOOTSTRAP SUPER ADMIN`.
