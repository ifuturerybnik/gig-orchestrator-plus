import { createFileRoute, Link } from "@tanstack/react-router";
import { APP_OPERATOR, formatOperatorAddress } from "@/lib/operator";
import { LEGAL_LAST_UPDATED, TERMS_LABEL } from "@/lib/legal";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Regulamin serwisu — Concertivo" },
      {
        name: "description",
        content:
          "Regulamin świadczenia usług drogą elektroniczną serwisu Concertivo. Operator: i-Future Sp. z o.o. Zasady kont, organizacji, płatności i reklamacji.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const op = APP_OPERATOR;
  const addr = formatOperatorAddress();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Strona główna
        </Link>
        <h1 className="mt-4 text-3xl font-semibold text-foreground">
          Regulamin serwisu Concertivo
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Wersja {TERMS_LABEL} · Ostatnia aktualizacja: {LEGAL_LAST_UPDATED}
        </p>

        <div className="prose prose-sm mt-8 max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold">§1. Postanowienia ogólne</h2>
            <p>
              Niniejszy Regulamin określa zasady świadczenia usług drogą elektroniczną w
              ramach serwisu internetowego <strong>{op.appName}</strong> (dalej: „
              <strong>Serwis</strong>") przez:
            </p>
            <p>
              <strong>{op.legalName}</strong> z siedzibą pod adresem {addr}, wpisaną do
              rejestru przedsiębiorców KRS pod numerem <strong>{op.krs}</strong>, NIP{" "}
              <strong>{op.nip}</strong>, REGON <strong>{op.regon}</strong> (dalej: „
              <strong>Operator</strong>").
            </p>
            <p>
              Kontakt z Operatorem:{" "}
              <a href={`mailto:${op.contactEmail}`} className="underline">{op.contactEmail}</a>.
            </p>
            <p>
              Regulamin stanowi regulamin świadczenia usług drogą elektroniczną w rozumieniu
              ustawy z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną (Dz.U. 2020
              poz. 344 ze zm.).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§2. Definicje</h2>
            <ul className="ml-6 list-disc space-y-1">
              <li><strong>Serwis</strong> — aplikacja internetowa Concertivo dostępna pod adresem concertivo.eu oraz powiązanymi subdomenami.</li>
              <li><strong>Operator</strong> — {op.legalName}.</li>
              <li><strong>Użytkownik</strong> — osoba fizyczna posiadająca aktywne konto w Serwisie, która ukończyła 16 lat (lub od 13 lat za zgodą opiekuna prawnego).</li>
              <li><strong>Konto</strong> — indywidualne, chronione hasłem konto w Serwisie umożliwiające korzystanie z funkcji.</li>
              <li><strong>Organizacja</strong> — zespół muzyczny, firma estradowa, eventowa lub inna jednostka organizacyjna zarejestrowana w Serwisie.</li>
              <li><strong>Owner</strong> — Użytkownik zarządzający Organizacją, posiadający najszersze uprawnienia w jej obrębie.</li>
              <li><strong>Konsument</strong> — Użytkownik będący konsumentem w rozumieniu art. 22¹ Kodeksu cywilnego.</li>
              <li><strong>Przedsiębiorca na prawach konsumenta</strong> — osoba fizyczna prowadząca działalność gospodarczą zawierająca umowę niezwiązaną bezpośrednio z jej działalnością zawodową (art. 38a ustawy o prawach konsumenta).</li>
              <li><strong>Usługi płatne</strong> — funkcje Serwisu dostępne wyłącznie w ramach wybranego płatnego planu.</li>
              <li><strong>Polityka prywatności</strong> — dokument dostępny pod adresem /privacy.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§3. Warunki techniczne</h2>
            <p>
              Do korzystania z Serwisu wymagane są: urządzenie z dostępem do Internetu,
              aktualna przeglądarka internetowa (Chrome, Firefox, Safari, Edge w wersji nie
              starszej niż 24 miesiące), włączona obsługa JavaScript i plików cookie, aktywny
              adres email.
            </p>
            <p>
              Operator dokłada starań aby Serwis działał nieprzerwanie, jednak nie gwarantuje
              dostępności na poziomie 100%. Operator zastrzega sobie prawo do planowanych
              przerw technicznych, o których w miarę możliwości informuje z wyprzedzeniem.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§4. Rejestracja i konto</h2>
            <p>
              Założenie Konta wymaga: podania prawdziwych i aktualnych danych, akceptacji
              Regulaminu, akceptacji Polityki prywatności, potwierdzenia adresu email.
            </p>
            <p>
              Z Serwisu mogą korzystać osoby, które ukończyły 16 lat. Osoby między 13 a 16
              rokiem życia mogą korzystać z Serwisu wyłącznie za uprzednią zgodą rodzica lub
              opiekuna prawnego przesłaną na adres{" "}
              <a href={`mailto:${op.rodoEmail}`} className="underline">{op.rodoEmail}</a>.
            </p>
            <p>
              Użytkownik zobowiązuje się do aktualizowania danych w razie ich zmiany oraz do
              ochrony danych logowania (hasło, drugi składnik 2FA). Operator zaleca włączenie
              weryfikacji dwuetapowej (2FA), w szczególności dla kont, na których przechowywane
              są dane wrażliwe (PESEL, IBAN, NIP).
            </p>
            <p>
              Jedna osoba może posiadać tylko jedno Konto osobiste. Zakaz zakładania kont
              fikcyjnych lub w cudzym imieniu bez upoważnienia.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§5. Organizacje</h2>
            <p>
              Użytkownik może założyć Organizację lub dołączyć do istniejącej Organizacji na
              zaproszenie Ownera. Każda nowo zarejestrowana Organizacja może podlegać
              weryfikacji przez Operatora.
            </p>
            <p>
              Owner Organizacji jest odpowiedzialny za zgodność danych Organizacji ze stanem
              faktycznym i prawnym oraz za zarządzanie uprawnieniami członków.
            </p>
            <p>
              Operator zastrzega sobie prawo do odmowy rejestracji lub zawieszenia Organizacji,
              której działalność narusza Regulamin lub przepisy prawa.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§6. Dane do rozliczeń i ich ochrona</h2>
            <p>
              Użytkownik dobrowolnie podaje preferowaną formę rozliczenia oraz dane niezbędne
              do wystawienia umowy lub faktury (m.in. PESEL, seria i numer dowodu, NIP, REGON,
              numer rachunku bankowego).
            </p>
            <p>
              Dane wrażliwe (PESEL, seria i numer dowodu osobistego, numer rachunku bankowego)
              są przechowywane w bazie danych w postaci{" "}
              <strong>zaszyfrowanej algorytmem AES-256-GCM</strong>, a klucz szyfrujący
              znajduje się poza bazą danych. Szczegóły opisuje Polityka prywatności (§3).
            </p>
            <p>
              Dane rozliczeniowe są udostępniane wyłącznie: Tobie, ownerom Organizacji, do
              których należysz, Operatorowi (w celu wsparcia technicznego i realizacji
              obowiązków księgowych) oraz uprawnionym organom państwowym na żądanie wynikające
              z przepisów prawa.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§7. Usługi płatne i model freemium</h2>
            <p>
              Serwis działa w modelu <strong>freemium</strong> — podstawowy zakres funkcji jest
              bezpłatny, a wybrane funkcje rozszerzone dostępne są w ramach płatnych planów.
              Aktualny cennik i zakres planów dostępne są w Serwisie.
            </p>
            <p>
              Płatności obsługiwane są przez operatora płatności <strong>CashBill S.A.</strong>{" "}
              (ul. Sobieskiego 2, 40-082 Katowice, KRS 0000323297). Operator nie przechowuje
              danych kart płatniczych — są one przetwarzane bezpośrednio przez CashBill.
            </p>
            <p>
              Płatne plany rozliczane są w okresach miesięcznych lub rocznych. Brak terminowej
              płatności skutkuje automatycznym przejściem konta na plan bezpłatny po upływie
              okresu opłaconego, bez utraty danych.
            </p>
            <p>
              Faktura VAT wystawiana jest na dane podane przez Użytkownika w panelu
              rozliczeniowym i udostępniana w formie elektronicznej (na co Użytkownik wyraża
              zgodę zgodnie z art. 106n ust. 1 ustawy o VAT).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">
              §8. Prawo odstąpienia (Konsumenci i przedsiębiorcy na prawach konsumenta)
            </h2>
            <p>
              Konsumentowi oraz przedsiębiorcy na prawach konsumenta przysługuje prawo
              odstąpienia od umowy o świadczenie Usług płatnych zawartej na odległość w
              terminie <strong>14 dni</strong> od dnia jej zawarcia, bez podania przyczyny,
              przez przesłanie oświadczenia na adres{" "}
              <a href={`mailto:${op.contactEmail}`} className="underline">{op.contactEmail}</a>.
            </p>
            <p>
              <strong>Uwaga:</strong> jeżeli zażądasz rozpoczęcia świadczenia Usługi płatnej
              przed upływem 14-dniowego terminu odstąpienia i wyraźnie się na to zgodzisz w
              momencie zakupu, a Usługa zostanie w pełni wykonana — tracisz prawo odstąpienia
              (art. 38 pkt 1 ustawy o prawach konsumenta). W przypadku częściowego wykonania —
              zapłacisz proporcjonalnie za świadczenie zrealizowane do dnia odstąpienia.
            </p>
            <p>
              Zwrot uiszczonych płatności następuje w terminie 14 dni od otrzymania
              oświadczenia o odstąpieniu, tym samym kanałem płatniczym, którym dokonano
              płatności.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§9. Zasady korzystania — zakazy</h2>
            <p>Użytkownikowi zakazuje się:</p>
            <ul className="ml-6 list-disc space-y-1">
              <li>dostarczania treści o charakterze bezprawnym, w szczególności naruszających prawa autorskie, dobra osobiste, zawierających mowę nienawiści lub treści pornograficzne;</li>
              <li>podejmowania działań mogących utrudniać lub destabilizować pracę Serwisu (m.in. ataki DDoS, próby nieuprawnionego dostępu, scrapowanie);</li>
              <li>wykorzystywania danych innych Użytkowników w sposób sprzeczny z prawem lub Regulaminem (w szczególności do spamu, marketingu bez zgody, identyfikacji w celach niezgodnych z celem powierzenia);</li>
              <li>tworzenia kont w cudzym imieniu bez upoważnienia;</li>
              <li>obchodzenia zabezpieczeń technicznych Serwisu.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§10. Funkcja „zaproś znajomego"</h2>
            <p>
              Użytkownik korzystający z funkcji zaproszenia oświadcza, że dysponuje zgodą
              osoby zapraszanej na przekazanie jej adresu email Operatorowi w celu wysłania
              jednorazowego zaproszenia. Operator nie wykorzystuje tych adresów do innych
              celów ani nie zachowuje ich poza okresem niezbędnym do realizacji zaproszenia.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§11. Odpowiedzialność</h2>
            <p>
              Operator świadczy usługi z należytą starannością, jednak — w zakresie
              dopuszczalnym przez prawo i z wyłączeniem odpowiedzialności wobec Konsumentów —
              nie ponosi odpowiedzialności za:
            </p>
            <ul className="ml-6 list-disc space-y-1">
              <li>przerwy w działaniu Serwisu wynikające z przyczyn niezależnych od Operatora (siła wyższa, awarie dostawców infrastruktury);</li>
              <li>treści publikowane przez Użytkowników oraz ustalenia i rozliczenia zawierane między Użytkownikami;</li>
              <li>utratę danych spowodowaną działaniem lub zaniechaniem Użytkownika (np. utrata hasła, samodzielne usunięcie konta);</li>
              <li>działania osób trzecich, którym Użytkownik udostępnił dane dostępowe.</li>
            </ul>
            <p>
              Wobec Użytkowników niebędących Konsumentami całkowita odpowiedzialność Operatora
              z tytułu Regulaminu ograniczona jest do sumy opłat uiszczonych przez Użytkownika w
              ciągu 12 miesięcy poprzedzających zdarzenie wywołujące szkodę. Ograniczenie to
              nie dotyczy szkody wyrządzonej z winy umyślnej.
            </p>
            <p>
              Postanowienia ograniczające odpowiedzialność nie znajdują zastosowania wobec
              Konsumentów ani przedsiębiorców na prawach konsumenta w zakresie, w jakim
              naruszałyby ich prawa wynikające z przepisów bezwzględnie obowiązujących.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§12. Reklamacje</h2>
            <p>
              Reklamacje dotyczące funkcjonowania Serwisu lub świadczonych usług można składać:
            </p>
            <ul className="ml-6 list-disc space-y-1">
              <li>
                pocztą elektroniczną na adres{" "}
                <a href={`mailto:${op.contactEmail}`} className="underline">{op.contactEmail}</a>;
              </li>
              <li>pisemnie na adres siedziby Operatora: {addr}.</li>
            </ul>
            <p>
              Reklamacja powinna zawierać: oznaczenie Użytkownika (login/email), opis
              problemu, oczekiwany sposób rozpatrzenia.
            </p>
            <p>
              Operator rozpatruje reklamacje w terminie <strong>14 dni</strong> od daty
              otrzymania. Brak odpowiedzi w tym terminie wobec Konsumenta oznacza uznanie
              reklamacji.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§13. Zawieszenie i usunięcie konta</h2>
            <p>
              Operator może zawiesić lub usunąć Konto Użytkownika naruszającego Regulamin lub
              przepisy prawa, po uprzednim wezwaniu do zaprzestania naruszeń (chyba że
              natychmiastowe działanie jest niezbędne dla ochrony Serwisu lub innych
              Użytkowników).
            </p>
            <p>
              Użytkownik może w dowolnym momencie usunąć Konto z poziomu panelu profilu
              (przycisk „Usuń konto"). Usunięcie Konta powoduje natychmiastowe usunięcie
              danych osobowych Użytkownika, z zastrzeżeniem danych, których przechowywanie
              jest wymagane przepisami prawa (m.in. dane na fakturach — 5 lat od końca roku
              kalendarzowego zgodnie z art. 74 ustawy o rachunkowości).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§14. Zmiany Regulaminu</h2>
            <p>
              Operator może zmienić Regulamin z ważnych powodów (zmiana przepisów prawa, nowe
              funkcje, względy bezpieczeństwa, zmiana modelu rozliczeń).
            </p>
            <p>
              O zmianach Operator poinformuje Użytkowników pocztą elektroniczną oraz w
              Serwisie z wyprzedzeniem co najmniej <strong>14 dni</strong> przed wejściem zmian
              w życie. Przy najbliższym logowaniu Użytkownik zostanie poproszony o
              zaakceptowanie nowej wersji. Brak akceptacji uprawnia Użytkownika do usunięcia
              Konta — bez dalszych konsekwencji.
            </p>
            <p>
              Każda wersja Regulaminu oznaczona jest datą i numerem wersji. Archiwum
              poprzednich wersji udostępniamy na żądanie kierowane na adres{" "}
              <a href={`mailto:${op.contactEmail}`} className="underline">{op.contactEmail}</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§15. Pozasądowe rozwiązywanie sporów</h2>
            <p>
              Konsument może skorzystać z pozasądowych sposobów rozpatrywania reklamacji i
              dochodzenia roszczeń, w tym:
            </p>
            <ul className="ml-6 list-disc space-y-1">
              <li>mediacji przy wojewódzkich inspektoratach Inspekcji Handlowej;</li>
              <li>postępowania przed stałym polubownym sądem konsumenckim;</li>
              <li>
                platformy internetowego rozstrzygania sporów (ODR) Komisji Europejskiej:{" "}
                <a href="https://ec.europa.eu/consumers/odr" className="underline" target="_blank" rel="noreferrer">
                  ec.europa.eu/consumers/odr
                </a>
                .
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§16. Prawo właściwe i jurysdykcja</h2>
            <p>
              W sprawach nieuregulowanych Regulaminem zastosowanie znajdują przepisy prawa
              polskiego, w szczególności Kodeksu cywilnego, ustawy o świadczeniu usług drogą
              elektroniczną, ustawy o prawach konsumenta, RODO oraz polskiej ustawy o ochronie
              danych osobowych.
            </p>
            <p>
              Sądem właściwym do rozstrzygania sporów wynikających z Regulaminu jest sąd
              właściwy dla siedziby Operatora, z zastrzeżeniem że dla sporów z udziałem
              Konsumentów właściwość sądu określają bezwzględnie obowiązujące przepisy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">§17. Postanowienia końcowe</h2>
            <p>
              Regulamin wchodzi w życie z dniem {LEGAL_LAST_UPDATED} w wersji {TERMS_LABEL}.
            </p>
            <p>
              Jeżeli którekolwiek z postanowień Regulaminu zostanie uznane za nieważne lub
              bezskuteczne, pozostałe postanowienia pozostają w mocy.
            </p>
          </section>

          <section className="rounded-md border border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">
              Dokument w wersji {TERMS_LABEL}, obowiązuje od {LEGAL_LAST_UPDATED}. Pytania:{" "}
              <a href={`mailto:${op.contactEmail}`} className="underline">{op.contactEmail}</a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
