// Szczegółowa instrukcja podłączenia skrzynki e-Doręczeń do Concertivo.
// Osadzana w `EdoreczeniaSetup` (profil użytkownika, profil organizacji,
// panel administracyjny). Napisana łopatologicznie — użytkownik nietechniczny
// powinien być w stanie przejść przez integrację samodzielnie.
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpen,
  Download,
  ExternalLink,
  KeyRound,
  Lock,
  ShieldCheck,
  Sparkles,
  Info,
  CheckCircle2,
} from "lucide-react";
import edorStep1Asset from "@/assets/edoreczenia/edor-step1.asset.json";
import edorStep2Asset from "@/assets/edoreczenia/edor-step2.asset.json";
import edorStep3Asset from "@/assets/edoreczenia/edor-step3.asset.json";

function GuideScreenshot({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption: string;
}) {
  return (
    <figure className="rounded-md border border-border bg-muted/30 p-2">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="mx-auto max-h-[420px] w-auto rounded-sm border border-border/60 bg-background object-contain"
      />
      <figcaption className="mt-2 text-center text-xs text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  );
}

// ClientId Concertivo — wartość rejestrowana przez użytkownika w biznes.gov.pl
const CONCERTIVO_CLIENT_ID = "AE:PL-75293-86443-CJWRC-25.SYSTEM.CONCERTIVO";
const QWAC_DOWNLOAD_URL = "/api/public/concertivo-qwac.crt";
// Fingerprint aktualnego QWAC — użytkownik może zweryfikować, że pobrany plik
// zgadza się z certyfikatem serwerowym. W razie odnowienia certyfikatu
// wartość trzeba zaktualizować.
const QWAC_FINGERPRINT_SHA256 =
  "B4:6B:D1:62:17:60:65:41:DE:35:EC:34:E6:2E:58:AA:48:5C:F0:C3:89:5C:6B:33:6E:D3:19:7A:02:81:86:11";

export default function EdoreczeniaSetupGuide() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Jak podłączyć skrzynkę e-Doręczeń — instrukcja krok po kroku
            </CardTitle>
            <CardDescription>
              Cała integracja zajmuje ~5 minut. Nie musisz kupować certyfikatu ani mieć wiedzy technicznej —
              Concertivo używa własnego certyfikatu QWAC, Ty tylko autoryzujesz nas w swojej skrzynce w
              biznes.gov.pl.
            </CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0">
            <Sparkles className="h-3 w-3 mr-1" />
            ~5 min
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertTitle>Zanim zaczniesz</AlertTitle>
          <AlertDescription className="text-xs space-y-1 mt-1">
            <div>• Musisz mieć aktywną skrzynkę e-Doręczeń (adres w formacie <span className="font-mono">AE:PL-…</span>).</div>
            <div>• Musisz być administratorem tej skrzynki na <span className="font-mono">biznes.gov.pl</span> (lub mieć uprawnienia do dodawania systemów zewnętrznych).</div>
            <div>• Przygotuj przeglądarkę zalogowaną do <span className="font-mono">biznes.gov.pl</span> obok tego okna.</div>
          </AlertDescription>
        </Alert>

        <Accordion type="single" collapsible defaultValue="step-1" className="w-full">
          {/* ==================== KROK 0 — Co to jest ==================== */}
          <AccordionItem value="step-0">
            <AccordionTrigger>
              <span className="flex items-center gap-2 text-left">
                <Info className="h-4 w-4 text-muted-foreground" />
                Po co to i jak to działa (30 s czytania)
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-sm space-y-2">
              <p>
                e-Doręczenia to państwowy odpowiednik listu poleconego. Zamiast logować się co dzień na
                <span className="font-mono"> biznes.gov.pl </span> i sprawdzać skrzynkę ręcznie, autoryzujesz
                Concertivo jako „system zewnętrzny" swojej skrzynki. My łączymy się z API e-Doręczeń w Twoim
                imieniu, pobieramy wiadomości i pozwalamy Ci wysyłać nowe — wszystko z poziomu Concertivo.
              </p>
              <pre className="rounded-md bg-muted p-3 text-[11px] font-mono leading-relaxed overflow-x-auto">
{`Twoja skrzynka e-Doręczeń  ⇄  API e-Doręczeń (KSDE)  ⇄  Concertivo
       (biznes.gov.pl)              (Poczta Polska)         (nasz serwer)
                                                             ↑
                                            certyfikat QWAC Concertivo
                                            + Twoje ID autoryzacji`}
              </pre>
              <p className="text-xs text-muted-foreground">
                Certyfikat QWAC to elektroniczny „dowód osobisty" naszego systemu. Klucz prywatny nigdy nie
                opuszcza naszego serwera. Ty w kroku 1 pobierzesz TYLKO część publiczną, żeby wgrać ją w
                biznes.gov.pl jako identyfikator zaufanego systemu.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* ==================== KROK 1 — pobierz cert ==================== */}
          <AccordionItem value="step-1">
            <AccordionTrigger>
              <span className="flex items-center gap-2 text-left">
                <Download className="h-4 w-4 text-primary" />
                Krok 1 — Pobierz certyfikat Concertivo (plik <span className="font-mono">.crt</span>)
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-sm space-y-3">
              <p>
                Kliknij przycisk poniżej. Przeglądarka zapisze plik{" "}
                <span className="font-mono">concertivo-qwac.crt</span> na dysku (typowo w folderze „Pobrane").
                Plik zawiera wyłącznie część publiczną — jest bezpieczny do udostępnienia.
              </p>
              <Button asChild size="sm">
                <a href={QWAC_DOWNLOAD_URL} download="concertivo-qwac.crt">
                  <Download className="h-4 w-4 mr-2" />
                  Pobierz concertivo-qwac.crt
                </a>
              </Button>
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs space-y-1">
                <div className="font-medium">Weryfikacja pliku (opcjonalnie):</div>
                <div>Wystawca: <span className="font-mono">CenCert QTSP WEB CA</span> (kwalifikowany)</div>
                <div>Podmiot: <span className="font-mono">CN=concertivo.eu, O=i-Future sp. z o.o.</span></div>
                <div className="break-all">
                  SHA-256: <span className="font-mono">{QWAC_FINGERPRINT_SHA256}</span>
                </div>
                <div className="text-muted-foreground pt-1">
                  Możesz sprawdzić fingerprint komendą <span className="font-mono">openssl x509 -in concertivo-qwac.crt -noout -fingerprint -sha256</span> — musi się zgadzać z powyższą wartością.
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ==================== KROK 2 — autoryzacja w biznes.gov ==================== */}
          <AccordionItem value="step-2">
            <AccordionTrigger>
              <span className="flex items-center gap-2 text-left">
                <ExternalLink className="h-4 w-4 text-primary" />
                Krok 2 — Zarejestruj Concertivo jako system zewnętrzny w biznes.gov.pl
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-sm space-y-3">
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  Zaloguj się na{" "}
                  <a
                    href="https://www.biznes.gov.pl/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-medium inline-flex items-center gap-1"
                  >
                    biznes.gov.pl <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  (Profilem Zaufanym, mObywatelem lub kwalifikowanym podpisem).
                </li>
                <li>
                  W menu wybierz <b>Moje konto → Skrzynka e-Doręczeń</b>, a następnie w sekcji{" "}
                  <b>Ustawienia skrzynki</b> otwórz zakładkę <b>Systemy zewnętrzne</b> (bywa nazywana też{" "}
                  <i>„Aplikacje zewnętrzne"</i> lub <i>„Integracje"</i>).
                </li>
                <li>
                  Kliknij <b>Dodaj system</b> / <b>Dodaj aplikację</b>.
                </li>
                <li>
                  W polu <b>Nazwa systemu</b> wpisz np. <span className="font-mono">Concertivo</span> (dowolna).
                </li>
                <li>
                  W polu <b>ClientId</b> (albo <i>„Identyfikator systemu"</i>) wklej dokładnie:
                  <div className="mt-1 rounded-md border border-border bg-muted p-2 font-mono text-xs break-all select-all">
                    {CONCERTIVO_CLIENT_ID}
                  </div>
                </li>
                <li>
                  Załaduj certyfikat: <b>Wgraj plik</b> → wskaż pobrany w kroku 1{" "}
                  <span className="font-mono">concertivo-qwac.crt</span>.
                </li>
                <li>
                  <b>Uprawnienia</b> — zaznacz co Concertivo ma mieć wolno robić w Twojej skrzynce:
                  <ul className="list-disc pl-5 mt-1 space-y-0.5 text-xs">
                    <li>Odczyt wiadomości (odebrane, wysłane, robocze, usunięte)</li>
                    <li>Wysyłka wiadomości</li>
                    <li>Zarządzanie folderami / przenoszenie do kosza</li>
                    <li>Pobieranie dowodów technicznych i UPO</li>
                  </ul>
                </li>
                <li>
                  Zapisz. Biznes.gov wygeneruje/wyświetli <b>Twój ClientId</b> — <b>zapisz go</b>, wróć tutaj
                  i wklej w polu „ClientId" formularza poniżej.
                </li>
              </ol>
              <Alert variant="default" className="mt-2">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Screenshoty ekranów biznes.gov.pl dokumentujące ścieżkę są w przygotowaniu — układ menu
                  bywa aktualizowany przez Pocztę Polską. Jeśli nazwy się różnią, szukaj sekcji o nazwie
                  „System zewnętrzny", „Aplikacja integracyjna" lub „API".
                </AlertDescription>
              </Alert>
            </AccordionContent>
          </AccordionItem>

          {/* ==================== KROK 3 — dane skrzynki ==================== */}
          <AccordionItem value="step-3">
            <AccordionTrigger>
              <span className="flex items-center gap-2 text-left">
                <KeyRound className="h-4 w-4 text-primary" />
                Krok 3 — Odczytaj adres swojej skrzynki
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-sm space-y-2">
              <p>W biznes.gov.pl, w widoku skrzynki e-Doręczeń, na górze znajdziesz adres w formacie:</p>
              <pre className="rounded-md bg-muted p-2 text-xs font-mono">AE:PL-XXXXX-XXXXX-XXXXX-XX</pre>
              <p>Skopiuj tę wartość — będzie potrzebna w polu <b>Adres skrzynki</b> formularza poniżej.</p>
            </AccordionContent>
          </AccordionItem>

          {/* ==================== KROK 4 — formularz Concertivo ==================== */}
          <AccordionItem value="step-4">
            <AccordionTrigger>
              <span className="flex items-center gap-2 text-left">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Krok 4 — Uzupełnij formularz w Concertivo i przetestuj
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-sm space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li>
                  Kliknij <b>Dodaj skrzynkę</b> w karcie poniżej.
                </li>
                <li>
                  <b>Nazwa</b> — dowolna etykieta (np. „Skrzynka firmowa", „Kancelaria główna").
                </li>
                <li>
                  <b>Adres skrzynki</b> — wklej <span className="font-mono">AE:PL-…</span> z kroku 3.
                </li>
                <li>
                  <b>ClientId</b> — wklej ClientId wygenerowany przez biznes.gov.pl w kroku 2, punkt 8.
                </li>
                <li>
                  <b>Środowisko</b> — pozostaw <b>Produkcja</b>, chyba że masz skrzynkę testową.
                </li>
                <li>Zapisz.</li>
                <li>
                  Kliknij <b>Testuj</b> obok skrzynki. Wszystkie kroki (Config → mTLS → OAuth2) powinny być
                  na zielono. Jeśli nie — patrz „FAQ / Diagnoza" poniżej.
                </li>
                <li>
                  Gotowe. W panelu <b>Administracja → e-Doręczenia</b> (lub <b>Korespondencja → e-Doręczenia</b>{" "}
                  dla skrzynek osobistych) możesz teraz synchronizować i wysyłać wiadomości.
                </li>
              </ol>
            </AccordionContent>
          </AccordionItem>

          {/* ==================== BEZPIECZEŃSTWO ==================== */}
          <AccordionItem value="security">
            <AccordionTrigger>
              <span className="flex items-center gap-2 text-left">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Bezpieczeństwo — co widzi Concertivo, jak są chronione dane
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-sm space-y-2">
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Klucz prywatny QWAC <b>nigdy nie opuszcza naszego serwera</b>. Ty pobierasz tylko część publiczną.
                </li>
                <li>
                  Adres skrzynki i ClientId są w bazie <b>szyfrowane AES-256-GCM</b> (kluczem znanym tylko
                  aplikacji), a dostęp jest ograniczony przez Row-Level Security do właściciela skrzynki
                  (użytkownika lub członków organizacji z odpowiednią rolą).
                </li>
                <li>
                  Uprawnienia nadawane w kroku 2 są <b>odwoływalne w każdej chwili</b> w biznes.gov.pl —
                  wystarczy usunąć Concertivo z listy systemów zewnętrznych. Skrzynka pozostanie Twoja.
                </li>
                <li>
                  Wszystkie połączenia z API e-Doręczeń są dwustronnie uwierzytelniane (mTLS) i podpisane
                  krótkoterminowym tokenem OAuth2.
                </li>
                <li>
                  Operator z dostępem administracyjnym do naszej infrastruktury <b>technicznie</b> mógłby
                  odszyfrować dane skrzynek — to standardowa architektura hostowanej integracji. Jeśli chcesz
                  większej izolacji, zobacz sekcję „Zaawansowane" (BYO-cert).
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* ==================== FAQ ==================== */}
          <AccordionItem value="faq">
            <AccordionTrigger>
              <span className="flex items-center gap-2 text-left">
                <Info className="h-4 w-4 text-muted-foreground" />
                FAQ / Diagnoza problemów
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-sm space-y-3">
              <div>
                <div className="font-medium">Test zwraca „OAuth2 FAIL HTTP 401"</div>
                <p className="text-xs text-muted-foreground">
                  ClientId nie został jeszcze aktywowany po stronie biznes.gov.pl albo wgrany certyfikat nie
                  pasuje do naszego. Sprawdź, że plik z kroku 1 to <b>ten sam</b>, który został wgrany w
                  kroku 2, i że w biznes.gov widnieje status „Aktywny".
                </p>
              </div>
              <div>
                <div className="font-medium">Test zwraca „OAuth2 FAIL HTTP 302"</div>
                <p className="text-xs text-muted-foreground">
                  Endpoint autoryzacji e-Doręczeń przekierowuje na stronę informacyjną — zwykle oznacza
                  chwilową przerwę techniczną KSDE. Poczekaj 5–10 minut i spróbuj ponownie.
                </p>
              </div>
              <div>
                <div className="font-medium">Test zwraca „mTLS handshake FAIL"</div>
                <p className="text-xs text-muted-foreground">
                  Certyfikat QWAC Concertivo wygasł/został odnowiony. Pobierz nowy plik z kroku 1 i wgraj
                  ponownie w biznes.gov.pl w miejsce starego.
                </p>
              </div>
              <div>
                <div className="font-medium">Nie widzę zakładki „Systemy zewnętrzne" w biznes.gov.pl</div>
                <p className="text-xs text-muted-foreground">
                  Konto na którym jesteś zalogowany nie jest administratorem skrzynki. Poproś administratora
                  organizacji o dodanie Ci uprawnień lub o wykonanie kroku 2 samodzielnie.
                </p>
              </div>
              <div>
                <div className="font-medium">Chcę odłączyć Concertivo od swojej skrzynki</div>
                <p className="text-xs text-muted-foreground">
                  W biznes.gov.pl usuń Concertivo z listy systemów zewnętrznych oraz w Concertivo (w
                  karcie skrzynek poniżej) kliknij ikonę kosza obok danej skrzynki.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ==================== BYO-cert (zaawansowane) ==================== */}
          <AccordionItem value="byo">
            <AccordionTrigger>
              <span className="flex items-center gap-2 text-left">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                Zaawansowane — własny certyfikat QWAC (BYO)
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-sm space-y-2">
              <p>
                Jeśli masz <b>własny kwalifikowany certyfikat QWAC</b> (np. wystawiony przez CenCert/DFT dla
                Twojej organizacji), możesz zamiast używać certyfikatu Concertivo podłączyć własny. Wtedy w
                biznes.gov.pl w kroku 2 wgrywasz swoją część publiczną, a w formularzu Concertivo — pod
                sekcją „Zaawansowane" — wgrywasz odpowiadający klucz prywatny (PEM). Klucz jest szyfrowany
                AES-256-GCM przed zapisaniem.
              </p>
              <p className="text-xs text-muted-foreground">
                Ta ścieżka jest sensowna głównie dla organizacji, które i tak posiadają QWAC do własnych
                systemów i chcą, aby ruch e-Doręczeń szedł „w ich imieniu" bez pośredniczącej tożsamości
                Concertivo.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
