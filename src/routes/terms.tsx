import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Regulamin serwisu — Concertivo" },
      {
        name: "description",
        content:
          "Regulamin korzystania z serwisu Concertivo. Operator: i-Future. Zasady kont, organizacji, odpowiedzialności i reklamacji.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Strona główna
        </Link>
        <h1 className="mt-4 text-3xl font-semibold text-foreground">Regulamin serwisu</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Wersja robocza — do uzupełnienia. Ostatnia aktualizacja: 25 maja 2026.
        </p>

        <div className="prose prose-sm mt-8 max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold">§1. Postanowienia ogólne</h2>
            <p>
              Operatorem serwisu Concertivo jest <strong>i-Future</strong> [pełna nazwa prawna,
              adres siedziby, NIP — do uzupełnienia]. Niniejszy regulamin określa zasady
              korzystania z serwisu przez muzyków, zespoły, firmy estradowe i eventowe oraz
              organizatorów koncertów.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§2. Definicje</h2>
            <ul className="ml-6 list-disc space-y-1">
              <li><strong>Serwis</strong> — aplikacja Concertivo dostępna pod adresem [domena].</li>
              <li><strong>Użytkownik</strong> — osoba fizyczna posiadająca konto.</li>
              <li><strong>Organizacja</strong> — zespół muzyczny, firma estradowa lub eventowa zarejestrowana w serwisie.</li>
              <li><strong>Owner</strong> — użytkownik zarządzający organizacją.</li>
              <li><strong>Operator</strong> — i-Future.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§3. Rejestracja i konto</h2>
            <p>
              Założenie konta wymaga podania prawdziwych danych, akceptacji regulaminu oraz
              polityki prywatności. Zalecane jest włączenie weryfikacji dwuetapowej (2FA),
              szczególnie dla kont z dostępem do danych wrażliwych (PESEL, IBAN, NIP).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§4. Organizacje</h2>
            <p>
              Każda nowo zarejestrowana organizacja podlega weryfikacji przez Operatora.
              Operator zastrzega sobie prawo odrzucenia zgłoszenia bez podania szczegółowej
              przyczyny. [Do uzupełnienia: kryteria weryfikacji, czas reakcji.]
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§5. Dane do rozliczeń</h2>
            <p>
              Użytkownik dobrowolnie podaje preferowaną formę rozliczenia oraz dane niezbędne
              do wystawienia umowy lub faktury. Dane te są udostępniane wyłącznie ownerom
              organizacji, do których użytkownik należy, oraz Operatorowi w celu wsparcia
              technicznego. Szczegóły w Polityce prywatności.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§6. Odpowiedzialność</h2>
            <p>
              [Do uzupełnienia — ograniczenia odpowiedzialności Operatora, przerwy techniczne,
              brak gwarancji dostępności 100%, wyłączenie odpowiedzialności za działania
              użytkowników między sobą.]
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§7. Płatności</h2>
            <p>[Do uzupełnienia — gdy uruchomimy płatne plany.]</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§8. Zawieszenie i usunięcie konta</h2>
            <p>
              Operator może zawiesić konto naruszające regulamin. Użytkownik może w dowolnym
              momencie usunąć konto z poziomu profilu — dane wymagane przepisami prawa
              (faktury, umowy) zostaną zachowane przez wymagany okres.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§9. Reklamacje</h2>
            <p>
              Reklamacje należy kierować na adres: <a href="mailto:support@i-future.pl">support@i-future.pl</a>.
              Odpowiedź w terminie do 14 dni.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§10. Zmiany regulaminu</h2>
            <p>
              O zmianach informujemy mailem oraz w aplikacji z prośbą o ponowną akceptację.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§11. Prawo właściwe</h2>
            <p>
              Prawo polskie. Sąd właściwy: właściwy dla siedziby Operatora, o ile bezwzględnie
              obowiązujące przepisy nie stanowią inaczej (konsumenci).
            </p>
          </section>

          <p className="text-xs text-muted-foreground">
            ⚠️ Powyższy tekst to <strong>szablon do edycji</strong>. Przed publikacją należy
            uzupełnić dane operatora i skonsultować treść z prawnikiem.
          </p>
        </div>
      </main>
    </div>
  );
}
