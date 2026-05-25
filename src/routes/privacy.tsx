import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Polityka prywatności — Concertivo" },
      {
        name: "description",
        content:
          "Polityka prywatności serwisu Concertivo — administrator danych: i-Future. Jakie dane zbieramy, w jakim celu i jakie masz prawa.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Strona główna
        </Link>
        <h1 className="mt-4 text-3xl font-semibold text-foreground">Polityka prywatności</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Wersja robocza — do uzupełnienia. Ostatnia aktualizacja: 25 maja 2026.
        </p>

        <div className="prose prose-sm mt-8 max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold">1. Administrator danych</h2>
            <p>
              Administratorem Twoich danych osobowych jest <strong>i-Future</strong> [pełna nazwa
              prawna, adres siedziby, NIP, KRS — do uzupełnienia]. Kontakt w sprawach ochrony
              danych: <a href="mailto:privacy@i-future.pl">privacy@i-future.pl</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Jakie dane przetwarzamy</h2>
            <ul className="ml-6 list-disc space-y-1">
              <li>
                <strong>Dane konta:</strong> imię, nazwisko, adres email, telefon, hasło (hash),
                preferowany język.
              </li>
              <li>
                <strong>Dane profilu:</strong> adres zamieszkania, role w branży muzycznej.
              </li>
              <li>
                <strong>Dane do rozliczeń (wrażliwe):</strong> PESEL, NIP, IBAN, urząd skarbowy,
                dane firmy — wyłącznie jeśli wybierzesz formę rozliczenia wymagającą tych
                informacji.
              </li>
              <li>
                <strong>Dane organizacji:</strong> nazwa, NIP, KRS, REGON, dane rejestrowe i
                kontaktowe — jeśli prowadzisz organizację w serwisie.
              </li>
              <li>
                <strong>Dane techniczne:</strong> adres IP, logi logowania, czas i typ
                aktywności (bezpieczeństwo).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Cele i podstawy przetwarzania</h2>
            <ul className="ml-6 list-disc space-y-1">
              <li>
                <strong>Świadczenie usługi</strong> — art. 6 ust. 1 lit. b RODO (umowa).
              </li>
              <li>
                <strong>Generowanie umów i dokumentów koncertowych</strong> — art. 6 ust. 1 lit. b
                + lit. c (obowiązki rachunkowe i podatkowe).
              </li>
              <li>
                <strong>Bezpieczeństwo konta (2FA, logi, MFA-trust)</strong> — art. 6 ust. 1 lit. f
                (prawnie uzasadniony interes).
              </li>
              <li>
                <strong>Marketing</strong> — art. 6 ust. 1 lit. a (zgoda, którą możesz wycofać w
                każdej chwili).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Kto ma dostęp do Twoich danych</h2>
            <p>Dostęp do Twoich danych w serwisie mają:</p>
            <ul className="ml-6 list-disc space-y-1">
              <li>Ty sam(a) — w pełnym zakresie.</li>
              <li>
                <strong>Właściciele (owner) organizacji</strong>, do których należysz — w
                zakresie niezbędnym do wystawienia umowy lub rozliczenia koncertu (dane do
                kontraktu, w tym dane wrażliwe jeśli sam(a) je uzupełnisz).
              </li>
              <li>
                <strong>i-Future</strong> jako właściciel i operator aplikacji — w zakresie
                administracji systemem i pomocy technicznej.
              </li>
              <li>
                Procesory: dostawca infrastruktury (Supabase, EU), hosting (Hostinger), dostawca
                poczty transakcyjnej — na podstawie umów powierzenia przetwarzania.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Okres przechowywania</h2>
            <p>
              [Do uzupełnienia — np. konto i profil: do momentu usunięcia konta + 30 dni;
              dane do umów: 5 lat od końca roku podatkowego; logi bezpieczeństwa: 12 miesięcy.]
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Twoje prawa</h2>
            <p>
              Masz prawo: dostępu do danych, sprostowania, usunięcia, ograniczenia
              przetwarzania, przeniesienia danych, sprzeciwu, wycofania zgody oraz skargi do
              Prezesa Urzędu Ochrony Danych Osobowych (uodo.gov.pl).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Transfery poza EOG</h2>
            <p>[Do uzupełnienia — jeśli korzystamy z dostawców spoza EOG.]</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Cookies</h2>
            <p>
              Używamy plików cookie wyłącznie do utrzymania sesji logowania i zapamiętania
              urządzenia przy włączonym 2FA (30 dni). Nie używamy ciasteczek marketingowych ani
              analitycznych zewnętrznych dostawców.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Zmiany polityki</h2>
            <p>
              O zmianach poinformujemy mailem oraz prośbą o ponowną akceptację w aplikacji.
            </p>
          </section>

          <p className="text-xs text-muted-foreground">
            ⚠️ Powyższy tekst to <strong>szablon do edycji</strong>. Przed publikacją należy
            uzupełnić dane administratora i zweryfikować treść z prawnikiem.
          </p>
        </div>
      </main>
    </div>
  );
}
