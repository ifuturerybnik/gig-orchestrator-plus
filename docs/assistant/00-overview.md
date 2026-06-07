# Concertivo — przegląd systemu

Concertivo to aplikacja webowa do zarządzania koncertami i pracą
organizacji muzyczno-eventowych. Operatorem aplikacji jest **i-Future**.
Produkcyjna domena: **concertivo.eu**.

## Typy organizacji

Użytkownik może zakładać i należeć do wielu organizacji jednocześnie.
Organizacja ma jeden lub więcej **typów** (pole `organizations.types`):

- **Eventowa** — agencja koncertowa, organizator imprez.
- **Estradowa** — artysta / zespół / management artysty.
- **Edukacyjna** — szkoła muzyczna, dom kultury, akademia.

Zestaw widocznych modułów w sidebarze zależy od typu organizacji oraz od
indywidualnych uprawnień członka (`organization_member_permissions`).

## Role

- **Owner** — twórca organizacji, ma wszystko.
- **Org admin** — pełne uprawnienia w danej organizacji.
- **Członek** — dostęp do podzbioru modułów zdefiniowanego przez admina.
- **Superadmin Concertivo / admin_staff** — globalny dostęp (Concertivo).

## Korespondencja, Kontakty, Kontrahenci — moduły globalne

Te trzy moduły mają jeden wspólny kod dla wszystkich typów organizacji.
Dodanie nowego typu organizacji nie wymaga pisania własnej Poczty / własnej
bazy kontaktów.

## Wsparcie AI

Każda organizacja ma własnego **Asystenta Concertivo** — agenta AI, który:

- zna dokumentację aplikacji (ten katalog) — RAG po `source_type = 'doc'`,
- rozumie kod (`source_type = 'code'`) — ale go nie cytuje użytkownikom
  spoza Concertivo,
- może na żądanie czytać dane organizacji **tylko** w zakresie modułów,
  do których ma dostęp zalogowany użytkownik,
- nigdy nie modyfikuje danych (MVP jest read-only).

Tokeny i koszt naliczane są na konto Concertivo z miesięcznym limitem per
organizacja (`organizations.assistant_monthly_limit_usd`, domyślnie 5 USD).
