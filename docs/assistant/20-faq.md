# FAQ — najczęstsze pytania użytkowników

## Jak dodać nowego członka do organizacji?

Moduł **Członkowie → Zaproś**. Podaj e-mail, zaznacz moduły, do których
ma mieć dostęp i ewentualnie przełącz „Administrator organizacji".
Zaproszony dostaje mail z linkiem; po akceptacji pojawia się na liście
członków. Domyślnie nowy członek **nie ma dostępu do żadnego modułu
konfigurowalnego** — trzeba świadomie zaznaczyć.

## Jak zmienić uprawnienia istniejącego członka?

**Członkowie → trzy kropki obok osoby → Uprawnienia**. Edytuj zaznaczone
moduły i tryby (Budżet, Wydarzenia, AI Studio).

## Mam organizację eventową i estradową — jedna czy dwie?

Możesz mieć **jedną organizację z dwoma typami** (`types: ['event','artist']`)
— wtedy sidebar pokaże moduły obu typów. Alternatywnie dwie osobne — jeśli
chcesz oddzielne dane, członków i finanse.

## Po co weryfikacja konta?

Weryfikacja oznacza, że Concertivo potwierdziło tożsamość organizacji i
można jej zaufać przy współdzielonych kontrahentach, zaproszeniach,
publikacjach. **Nie jest wymagana** — każda organizacja sama decyduje,
czy chce być zweryfikowana.

## Jak działa miesięczny limit Asystenta?

Każda organizacja ma `assistant_monthly_limit_usd` (domyślnie 5 USD).
Po jego przekroczeniu Asystent przestaje odpowiadać do końca miesiąca
kalendarzowego. Owner organizacji widzi zużycie w **Administracja →
Asystent**.

## Czy Asystent ma dostęp do modułów, których ja nie widzę?

Nie. Asystent dziedziczy 1:1 uprawnienia zalogowanego użytkownika.
Jeśli nie masz dostępu do Budżetu, Asystent też nie odczyta budżetu
przez swoje narzędzia.

## Czy Asystent może pokazać mi kod aplikacji?

Nie — kod jest indeksowany tylko po to, by Asystent lepiej rozumiał, jak
działa aplikacja. Fragmenty kodu nie są pokazywane użytkownikom (tylko
superadmin Concertivo widzi cytaty z kodu).
