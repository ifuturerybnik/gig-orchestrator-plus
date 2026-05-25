import { createFileRoute, Link } from "@tanstack/react-router";
import { APP_OPERATOR, formatOperatorAddress } from "@/lib/operator";
import { LEGAL_LAST_UPDATED, PRIVACY_LABEL } from "@/lib/legal";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Polityka prywatności — Concertivo" },
      {
        name: "description",
        content:
          "Polityka prywatności serwisu Concertivo. Administrator danych: i-Future Sp. z o.o. Zakres przetwarzania, podstawy prawne, prawa użytkownika, RODO.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const op = APP_OPERATOR;
  const addr = formatOperatorAddress();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Strona główna
        </Link>
        <h1 className="mt-4 text-3xl font-semibold text-foreground">Polityka prywatności</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Wersja {PRIVACY_LABEL} · Ostatnia aktualizacja: {LEGAL_LAST_UPDATED}
        </p>

        <div className="prose prose-sm mt-8 max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold">1. Administrator danych</h2>
            <p>
              Administratorem Twoich danych osobowych jest <strong>{op.legalName}</strong> z
              siedzibą pod adresem {addr}, wpisana do rejestru przedsiębiorców KRS pod numerem{" "}
              <strong>{op.krs}</strong>, NIP <strong>{op.nip}</strong>, REGON{" "}
              <strong>{op.regon}</strong> (dalej: „<strong>Administrator</strong>" lub „
              <strong>Operator</strong>").
            </p>
            <p>
              Operator nie powołał Inspektora Ochrony Danych. W sprawach związanych z
              przetwarzaniem danych osobowych skontaktuj się z nami:{" "}
              <a href={`mailto:${op.rodoEmail}`} className="underline">
                {op.rodoEmail}
              </a>
              .
            </p>
            <p>
              Niniejsza polityka dotyczy serwisu <strong>{op.appName}</strong> (dalej: „
              <strong>Serwis</strong>") oraz wszystkich powiązanych funkcji aplikacji.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Zakres przetwarzanych danych</h2>
            <p>Przetwarzamy następujące kategorie danych osobowych:</p>
            <ul className="ml-6 list-disc space-y-1">
              <li>
                <strong>Dane identyfikacyjne:</strong> imię, nazwisko, pseudonim sceniczny, data
                urodzenia, zdjęcie profilowe (awatar).
              </li>
              <li>
                <strong>Dane identyfikacyjne wysokiego ryzyka (opcjonalne, podawane wyłącznie
                gdy wybierzesz formę rozliczenia tego wymagającą):</strong> numer PESEL, seria i
                numer dowodu osobistego.
              </li>
              <li>
                <strong>Dane kontaktowe:</strong> adres email, numer telefonu, adres zamieszkania
                (ulica, kod pocztowy, miejscowość, kraj), adres do korespondencji (jeśli inny).
              </li>
              <li>
                <strong>Dane rozliczeniowe:</strong> NIP, REGON, KRS, numer rachunku bankowego
                (IBAN), nazwa banku i kod SWIFT (dla przelewów zagranicznych), forma prowadzonej
                działalności (osoba fizyczna, JDG, sp. z o.o., fundacja, stowarzyszenie).
              </li>
              <li>
                <strong>Dane zawodowe:</strong> instrument / specjalizacja, gatunek muzyczny,
                opis doświadczenia (bio), linki do portfolio (Spotify, YouTube, własna strona),
                stawka godzinowa / za koncert, dostępność (kalendarz).
              </li>
              <li>
                <strong>Dane generowane automatycznie:</strong> adres IP, identyfikator
                przeglądarki (user-agent), data i czas logowania, logi aktywności w Serwisie
                (bezpieczeństwo).
              </li>
              <li>
                <strong>Dane transakcyjne:</strong> historia koncertów, wystawionych umów i
                faktur powiązanych z Twoim kontem.
              </li>
              <li>
                <strong>Treści komunikacji:</strong> wiadomości przesyłane między użytkownikami
                w obrębie Serwisu (jeśli korzystasz z funkcji wiadomości).
              </li>
              <li>
                <strong>Cookies sesyjne:</strong> niezbędne pliki cookie utrzymujące sesję
                logowania i zapamiętanie zaufanego urządzenia przy 2FA.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">
              3. Szczególna ochrona danych identyfikacyjnych
            </h2>
            <p>
              Dane wrażliwe z punktu widzenia ryzyka kradzieży tożsamości (
              <strong>PESEL, seria i numer dowodu, numer rachunku bankowego</strong>) są
              przechowywane w bazie danych w postaci <strong>zaszyfrowanej algorytmem AES-256-GCM</strong>.
              Klucz szyfrujący nie jest przechowywany w bazie danych — znajduje się wyłącznie w
              zabezpieczonych zmiennych środowiskowych serwera. Oznacza to, że nawet w przypadku
              nieautoryzowanego dostępu do bazy danych, dane pozostają nieczytelne.
            </p>
            <p>
              Dane te są odszyfrowywane wyłącznie w momencie ich wyświetlenia uprawnionym osobom
              (Tobie, ownerom organizacji, do których należysz, oraz personelowi Operatora w
              celu wsparcia technicznego lub realizacji obowiązków księgowych).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Cele i podstawy prawne przetwarzania</h2>
            <ul className="ml-6 list-disc space-y-2">
              <li>
                <strong>Świadczenie usługi (prowadzenie konta, organizacji, kalendarza,
                portfolio)</strong> — art. 6 ust. 1 lit. b RODO (wykonanie umowy o świadczenie
                usług drogą elektroniczną).
              </li>
              <li>
                <strong>Realizacja rozliczeń koncertów: zawieranie umów, wystawianie faktur,
                obsługa płatności i przelewów</strong> — art. 6 ust. 1 lit. b RODO (wykonanie
                umowy) oraz art. 6 ust. 1 lit. c RODO (obowiązki rachunkowe i podatkowe).
              </li>
              <li>
                <strong>Wypełnienie obowiązków księgowo-podatkowych</strong> — art. 6 ust. 1
                lit. c RODO w związku z art. 74 ustawy z dnia 29 września 1994 r. o
                rachunkowości oraz przepisami ustawy o VAT.
              </li>
              <li>
                <strong>Bezpieczeństwo konta (logowanie, 2FA, logi, wykrywanie nadużyć)</strong>{" "}
                — art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes Operatora i użytkownika
                polegający na ochronie przed nieautoryzowanym dostępem).
              </li>
              <li>
                <strong>Dochodzenie i obrona roszczeń</strong> — art. 6 ust. 1 lit. f RODO
                (prawnie uzasadniony interes).
              </li>
              <li>
                <strong>Analityka korzystania z Serwisu</strong> — art. 6 ust. 1 lit. f RODO
                (prawnie uzasadniony interes polegający na ulepszaniu Serwisu). Korzystamy z
                <strong> Plausible Analytics</strong> — narzędzia analitycznego hostowanego w
                Unii Europejskiej, które <strong>nie używa plików cookie</strong> i nie zbiera
                danych osobowych identyfikujących użytkowników.
              </li>
              <li>
                <strong>Marketing własny (newsletter, informacje o nowych funkcjach, oferty)
                </strong> — art. 6 ust. 1 lit. a RODO (zgoda) oraz art. 10 ustawy o świadczeniu
                usług drogą elektroniczną. Zgodę możesz wycofać w każdej chwili klikając
                „rezygnuję" w stopce wiadomości lub w ustawieniach konta.
              </li>
              <li>
                <strong>Funkcja „zaproś znajomego"</strong> — art. 6 ust. 1 lit. f RODO (prawnie
                uzasadniony interes); zapraszający oświadcza, że dysponuje zgodą osoby
                zapraszanej na przekazanie jej adresu email w celu wysłania jednorazowego
                zaproszenia.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Odbiorcy danych</h2>
            <p>Twoje dane osobowe mogą być udostępniane następującym kategoriom odbiorców:</p>
            <ul className="ml-6 list-disc space-y-1">
              <li>
                <strong>Innym użytkownikom Serwisu</strong> — w zakresie informacji, które
                samodzielnie publikujesz w profilu publicznym (imię, pseudonim, bio,
                instrument, portfolio).
              </li>
              <li>
                <strong>Właścicielom (ownerom) organizacji</strong>, do których należysz — w
                zakresie niezbędnym do realizacji koncertów i rozliczeń (w tym danym
                rozliczeniowym jeśli sam(a) je uzupełnisz).
              </li>
              <li>
                <strong>Podmiotom przetwarzającym (procesorom) na podstawie umów powierzenia
                przetwarzania (art. 28 RODO):</strong>
                <ul className="ml-6 mt-1 list-disc space-y-1">
                  <li>
                    <strong>Hostinger International Ltd.</strong> — dostawca infrastruktury
                    serwerowej (VPS, EOG).
                  </li>
                  <li>
                    <strong>Supabase Inc.</strong> (San Francisco, USA) — dostawca bazy danych i
                    usług uwierzytelniania. Dane przechowywane w regionie UE; transfer poza EOG
                    zabezpieczony Standardowymi Klauzulami Umownymi Komisji Europejskiej
                    (decyzja 2021/914) oraz DPA Supabase.
                  </li>
                  <li>
                    <strong>CashBill S.A.</strong> (ul. Sobieskiego 2, 40-082 Katowice, KRS
                    0000323297) — operator płatności online.
                  </li>
                  <li>
                    <strong>Plausible Insights OÜ</strong> (Estonia, EOG) — dostawca analityki
                    bez cookies.
                  </li>
                  <li>
                    <strong>Biuro rachunkowe</strong> obsługujące Operatora — w zakresie
                    niezbędnym do realizacji obowiązków księgowych (faktury wystawione przez lub
                    na rzecz Operatora).
                  </li>
                  <li>
                    <strong>Kancelaria windykacyjna</strong> — wyłącznie w przypadku
                    nieuregulowanych należności, w zakresie niezbędnym do dochodzenia roszczeń.
                  </li>
                </ul>
              </li>
              <li>
                <strong>Organom państwowym</strong> — gdy obowiązek udostępnienia wynika z
                przepisów prawa (sądy, prokuratura, urzędy skarbowe).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Transfer danych poza EOG</h2>
            <p>
              Co do zasady Twoje dane przetwarzane są na terenie Europejskiego Obszaru
              Gospodarczego. Wyjątkiem jest korzystanie z usług <strong>Supabase Inc.</strong>{" "}
              (USA), która, pomimo przechowywania danych w regionie UE, jako spółka amerykańska
              podlega jurysdykcji USA. Transfer ten odbywa się na podstawie:
            </p>
            <ul className="ml-6 list-disc space-y-1">
              <li>
                Standardowych Klauzul Umownych (SCC) zatwierdzonych decyzją wykonawczą Komisji
                Europejskiej 2021/914;
              </li>
              <li>umowy powierzenia przetwarzania (DPA) zawartej z Supabase;</li>
              <li>
                dodatkowych środków technicznych (szyfrowanie at-rest i in-transit, klucz
                szyfrujący dane wrażliwe poza bazą).
              </li>
            </ul>
            <p>
              Na żądanie kierowane na adres{" "}
              <a href={`mailto:${op.rodoEmail}`} className="underline">
                {op.rodoEmail}
              </a>{" "}
              udostępniamy kopię stosowanych zabezpieczeń.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Okres przechowywania danych</h2>
            <ul className="ml-6 list-disc space-y-1">
              <li>
                <strong>Dane konta i profilu</strong> — przez okres posiadania konta. Po
                usunięciu konta dane są usuwane niezwłocznie (twardy delete).
              </li>
              <li>
                <strong>Dane rozliczeniowe powiązane z wystawionymi fakturami</strong> — przez
                okres <strong>5 lat</strong> licząc od końca roku kalendarzowego, w którym
                upłynął termin płatności podatku (art. 86 § 1 Ordynacji podatkowej, art. 74 ust.
                2 ustawy o rachunkowości). Po tym okresie dane są usuwane.
              </li>
              <li>
                <strong>Logi bezpieczeństwa (IP, user-agent, logowania)</strong> — 12 miesięcy.
              </li>
              <li>
                <strong>Dane przetwarzane na podstawie zgody (newsletter)</strong> — do momentu
                wycofania zgody.
              </li>
              <li>
                <strong>Dane niezbędne do dochodzenia lub obrony roszczeń</strong> — do upływu
                okresu przedawnienia (zasadniczo 6 lat, dla roszczeń związanych z działalnością
                gospodarczą 3 lata).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Twoje prawa</h2>
            <p>W związku z przetwarzaniem Twoich danych przysługują Ci następujące prawa:</p>
            <ul className="ml-6 list-disc space-y-1">
              <li><strong>dostępu do danych</strong> (art. 15 RODO) — w panelu profilu znajdziesz przycisk „Pobierz moje dane" (eksport JSON);</li>
              <li><strong>sprostowania danych</strong> (art. 16 RODO) — w panelu profilu;</li>
              <li><strong>usunięcia danych / „prawo do bycia zapomnianym"</strong> (art. 17 RODO) — w panelu profilu znajdziesz przycisk „Usuń konto";</li>
              <li><strong>ograniczenia przetwarzania</strong> (art. 18 RODO);</li>
              <li><strong>przeniesienia danych</strong> (art. 20 RODO) — eksport w formacie JSON;</li>
              <li><strong>sprzeciwu wobec przetwarzania</strong> opartego na prawnie uzasadnionym interesie (art. 21 RODO);</li>
              <li><strong>wycofania zgody</strong> w dowolnym momencie (nie wpływa na zgodność z prawem przetwarzania dokonanego przed wycofaniem) — art. 7 ust. 3 RODO;</li>
              <li>
                <strong>wniesienia skargi</strong> do organu nadzorczego — Prezesa Urzędu
                Ochrony Danych Osobowych, ul. Stawki 2, 00-193 Warszawa,{" "}
                <a href="https://uodo.gov.pl" className="underline" target="_blank" rel="noreferrer">uodo.gov.pl</a>.
              </li>
            </ul>
            <p>
              Żądania związane z realizacją powyższych praw możesz również kierować mailem na:{" "}
              <a href={`mailto:${op.rodoEmail}`} className="underline">{op.rodoEmail}</a>.
              Odpowiadamy bez zbędnej zwłoki, najpóźniej w terminie miesiąca od otrzymania
              żądania.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Dobrowolność podania danych</h2>
            <p>
              Podanie danych identyfikacyjnych i kontaktowych (imię, nazwisko, email) jest
              dobrowolne, ale niezbędne do założenia konta. Podanie danych rozliczeniowych
              (PESEL, NIP, IBAN itp.) jest dobrowolne i wymagane wyłącznie gdy korzystasz z
              funkcji rozliczeń koncertów — bez tych danych nie zawrzemy umowy i nie wystawimy
              faktury.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Pliki cookie</h2>
            <p>
              Serwis używa wyłącznie <strong>niezbędnych plików cookie</strong>:
            </p>
            <ul className="ml-6 list-disc space-y-1">
              <li>
                <strong>Cookies sesyjne</strong> — utrzymują sesję logowania, usuwane po
                zamknięciu przeglądarki lub wylogowaniu.
              </li>
              <li>
                <strong>Cookie zaufanego urządzenia (MFA-trust)</strong> — opcjonalne, ważne 30
                dni, ustawiane wyłącznie gdy zaznaczysz „Zapamiętaj to urządzenie" przy
                weryfikacji 2FA.
              </li>
              <li>
                <strong>Cookie preferencji języka</strong> — zapamiętuje wybrany język
                interfejsu.
              </li>
            </ul>
            <p>
              <strong>Nie używamy cookies marketingowych, śledzących ani analitycznych
              zewnętrznych dostawców.</strong> Plausible Analytics, z którego korzystamy, działa
              całkowicie bez cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">11. Wiek użytkowników</h2>
            <p>
              Serwis przeznaczony jest dla osób, które ukończyły 16 lat (próg wiekowy zgody na
              przetwarzanie danych osobowych w usługach społeczeństwa informacyjnego — art. 8
              RODO w związku z art. 8 ust. 1 polskiej ustawy o ochronie danych osobowych).
              Osoby między 13 a 16 rokiem życia mogą korzystać z Serwisu wyłącznie za zgodą
              rodzica lub opiekuna prawnego, którą należy przesłać na adres{" "}
              <a href={`mailto:${op.rodoEmail}`} className="underline">{op.rodoEmail}</a> przed
              założeniem konta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">12. Bezpieczeństwo</h2>
            <p>
              Stosujemy techniczne i organizacyjne środki ochrony danych zgodne ze stanem
              wiedzy technicznej, w tym m.in.: szyfrowanie połączeń (HTTPS/TLS), szyfrowanie
              danych wrażliwych w bazie (AES-256-GCM), Row-Level Security w warstwie bazy
              danych, weryfikację dwuetapową (2FA), regularne kopie zapasowe, ograniczony
              dostęp personelu na zasadzie wiedzy koniecznej.
            </p>
            <p>
              W przypadku naruszenia ochrony danych osobowych mogącego powodować ryzyko dla Twoich
              praw i wolności, poinformujemy Cię o tym bez zbędnej zwłoki, zgodnie z art. 34
              RODO.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">13. Zmiany Polityki prywatności</h2>
            <p>
              Każda nowa wersja Polityki jest oznaczona datą i numerem wersji. W przypadku
              istotnych zmian poinformujemy Cię z wyprzedzeniem za pośrednictwem poczty
              elektronicznej oraz poprosimy o ponowną akceptację przy najbliższym logowaniu.
              Archiwum poprzednich wersji udostępniamy na żądanie.
            </p>
          </section>

          <section className="rounded-md border border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">
              Dokument w wersji {PRIVACY_LABEL}, obowiązuje od {LEGAL_LAST_UPDATED}. W razie
              wątpliwości skontaktuj się z nami:{" "}
              <a href={`mailto:${op.rodoEmail}`} className="underline">{op.rodoEmail}</a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
