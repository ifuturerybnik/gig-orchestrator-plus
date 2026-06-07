# Baza wiedzy Asystenta Concertivo

Ten katalog zawiera **dokumentację aplikacji w języku naturalnym**, którą
asystent AI (per organizacja) indeksuje do RAG. Każdy plik `.md` zostaje
podzielony na fragmenty (~800 znaków), wektorzowany (`text-embedding-3-small`)
i zapisany w tabeli `ai_kb_chunks` jako `source_type = 'doc'`.

## ⏰ PRZYPOMNIENIE DLA AGENTA AI / OPIEKUNA PROJEKTU

**Aktualizuj tę dokumentację mniej więcej co 2 miesiące** lub gdy:

- doszedł nowy moduł w sidebarze organizacji (`src/lib/org-modules.ts`),
- doszło/zmieniło się duże flow użytkownika (np. zaproszenia, płatności,
  integracja zewnętrzna),
- zmieniły się role / uprawnienia / sposób konfiguracji uprawnień,
- doszły nowe pola w głównych formularzach (organizacja, kontakt, koncert,
  budżet, mail).

**Nie aktualizuj po każdej poprawce CSS lub przesunięciu przycisku.**
Indeks kodu (`source_type = 'code'`) i tak łapie zmiany w komponentach po
najbliższym reindeksie.

Po edycji któregokolwiek pliku w `docs/assistant/`:

1. Wejdź w **Administracja → Asystent → Baza wiedzy** (superadmin).
2. Kliknij **„Reindeksuj teraz"**.
3. Sprawdź, czy `chunks_total` wzrosła zgodnie z oczekiwaniem.

Jeśli minęło >60 dni od ostatniego pełnego reindeksu, cron
`assistant-kb-staleness-check` przyśle alert do superadminów.

## Struktura plików

| Plik | Zawartość |
| ---- | --------- |
| `00-overview.md` | Czym jest Concertivo, typy organizacji, główne moduły |
| `10-modules.md` | Opis każdego modułu sidebaru po kolei |
| `20-faq.md`    | Pytania najczęściej zadawane przez użytkowników |

Możesz dokładać kolejne pliki — wszystko z rozszerzeniem `.md` w tym
katalogu zostanie zaindeksowane.
