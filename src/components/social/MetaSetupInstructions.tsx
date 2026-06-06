import { useTranslation } from "react-i18next";
import { ExternalLink, AlertTriangle, Info, CheckCircle2 } from "lucide-react";

/**
 * Łopatologiczna instrukcja konfiguracji aplikacji Meta (Facebook + Instagram)
 * dla Concertivo. Spisana na podstawie udanej integracji produkcyjnej.
 *
 * Ważne fakty, które już zostały zweryfikowane w boju:
 *  - Facebook Login for Business zapisuje tylko Facebook Page.
 *  - Instagram Login API zapisuje osobny token IG wymagany do publikacji i moderacji komentarzy.
 *  - Konto IG musi być Business lub Creator (Personal NIE zadziała).
 *  - Endpoint OAuth: https://www.instagram.com/oauth/authorize
 *  - Redirect URI musi być DOKŁADNIE taki sam jak callbackUrl poniżej (z https://).
 *  - App domain w App Settings → Basic musi być sama domena, np. concertivo.eu,
 *    bez https:// i bez ścieżki.
 */
export function MetaSetupInstructions({ callbackUrl }: { callbackUrl: string }) {
  const { t } = useTranslation();

  // Wyciągamy domenę z callbackUrl (np. "concertivo.eu") do podpowiedzi
  let appDomain = "concertivo.eu";
  try {
    appDomain = new URL(callbackUrl).hostname;
  } catch {
    // fallback ok
  }

  return (
    <div className="space-y-5 text-sm">
      <div className="rounded-md border border-blue-300 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {t("social.meta.intro_title", "Facebook i Instagram łączymy osobnymi flow")}
            </p>
            <p className="mt-1">
              {t(
                "social.meta.intro_body",
                "Facebook Login for Business zapisuje wyłącznie stronę Facebook. Instagram musi być połączony osobno przyciskiem „Połącz z Instagram”, aby używać tokena Instagram Login API z uprawnieniem instagram_business_manage_comments.",
              )}
            </p>
          </div>
        </div>
      </div>

      <a
        href="https://developers.facebook.com/apps/"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {t("social.meta.open_portal", "Otwórz Meta for Developers")}
      </a>

      {/* === ETAP 1: Tworzenie aplikacji === */}
      <section className="space-y-2">
        <h4 className="font-semibold">
          {t("social.meta.step1_title", "Krok 1 — Utwórz aplikację")}
        </h4>
        <ol className="ml-1 list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>
            Na stronie <code className="rounded bg-muted px-1 py-0.5 text-xs">developers.facebook.com/apps</code>{" "}
            kliknij <b>„Create app"</b> (Utwórz aplikację).
          </li>
          <li>
            <b>App name:</b> wpisz dowolną nazwę, np. <code className="rounded bg-muted px-1 py-0.5 text-xs">Concertivo – {appDomain}</code>.
          </li>
          <li>
            <b>App contact email:</b> Twój email kontaktowy (Meta będzie tam wysyłać powiadomienia).
          </li>
          <li>
            <b>Use cases:</b> wybierz <b>„Other"</b> (Inne) — nie wybieraj gotowych presetów, bo nie obejmują pełnego zestawu, którego potrzebujemy.
          </li>
          <li>
            <b>App type:</b> wybierz <b>„Business"</b> i kliknij <b>Next</b> → <b>Create app</b>.
          </li>
          <li>
            Jeśli Meta poprosi o <b>Business Portfolio</b> (Business Manager), wybierz istniejące lub utwórz nowe.
          </li>
        </ol>
      </section>

      {/* === ETAP 2: App Settings → Basic === */}
      <section className="space-y-2">
        <h4 className="font-semibold">
          {t("social.meta.step2_title", "Krok 2 — App Settings → Basic")}
        </h4>
        <ol className="ml-1 list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>
            W menu po lewej rozwiń <b>App settings</b> → <b>Basic</b>.
          </li>
          <li>
            <b>App domains:</b> dodaj <code className="rounded bg-muted px-1 py-0.5 text-xs">{appDomain}</code>{" "}
            <span className="text-xs">(sama domena — bez <code>https://</code>, bez slasha, bez ścieżki)</span>.
          </li>
          <li>
            <b>Privacy Policy URL:</b>{" "}
            <code className="break-all rounded bg-muted px-1 py-0.5 text-xs">https://{appDomain}/privacy</code>
          </li>
          <li>
            <b>Terms of Service URL:</b>{" "}
            <code className="break-all rounded bg-muted px-1 py-0.5 text-xs">https://{appDomain}/terms</code>
          </li>
          <li>
            <b>Category:</b> np. <i>Business and Pages</i>.
          </li>
          <li>
            Zjedź na dół, kliknij <b>+ Add Platform</b> → <b>Website</b> i w polu <b>Site URL</b> wklej:{" "}
            <code className="break-all rounded bg-muted px-1 py-0.5 text-xs">https://{appDomain}</code>
          </li>
          <li>
            Kliknij <b>Save changes</b>.
          </li>
          <li>
            Skopiuj <b>App ID</b> i kliknij <b>Show</b> przy <b>App secret</b> — skopiuj go również. Wkleisz oba do formularza powyżej w Concertivo.
          </li>
        </ol>
      </section>

      {/* === ETAP 3: Facebook Login for Business === */}
      <section className="space-y-2">
        <h4 className="font-semibold">
          {t("social.meta.step3_title", "Krok 3 — Facebook Login for Business (dla Facebooka)")}
        </h4>
        <p className="text-muted-foreground text-xs">
          Facebook Login for Business używa <b>Configuration ID</b> — to „szablon" uprawnień, który dostajesz po
          utworzeniu konfiguracji. Bez Configuration ID Facebook nie pozwoli się połączyć.
        </p>
        <ol className="ml-1 list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>
            W menu po lewej kliknij <b>Add product</b> i przy <b>Facebook Login for Business</b> kliknij <b>Set up</b>.
          </li>
          <li>
            Wejdź w <b>Facebook Login for Business</b> → <b>Settings</b> i ustaw:
            <ul className="ml-1 mt-1 list-disc space-y-0.5 pl-5">
              <li><b>Client OAuth login:</b> Yes</li>
              <li><b>Web OAuth login:</b> Yes</li>
              <li><b>Enforce HTTPS:</b> Yes</li>
              <li>
                <b>Valid OAuth Redirect URIs</b> — wklej DOKŁADNIE (skopiuj przyciskiem, nie przepisuj):
                <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-xs">{callbackUrl}</code>
              </li>
            </ul>
            Kliknij <b>Save changes</b>.
          </li>
          <li>
            Przejdź do <b>Facebook Login for Business → Configurations</b> i kliknij <b>Create configuration</b>.
          </li>
          <li>
            <b>Access token type:</b> zaznacz <b>User access token</b> (NIE „System-user") → <b>Next</b>.
          </li>
          <li>
            Krok <b>Assets</b> może być niedostępny przy User access token — to normalne, użytkownik wybierze Strony/IG
            podczas logowania.
          </li>
          <li>
            <b>Select permissions</b> — zaznacz:
            <div className="mt-1 flex flex-wrap gap-1">
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">pages_show_list</code>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">pages_read_engagement</code>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">pages_manage_posts</code>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">pages_manage_metadata</code>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">pages_read_user_content</code>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">business_management</code>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">public_profile</code>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">instagram_basic</code>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">instagram_content_publish</code>
            </div>
            Kliknij <b>Create</b>.
          </li>
          <li>
            Skopiuj <b>Configuration ID</b> (długi numer) z listy konfiguracji — wkleisz go w formularzu Facebook
            w Concertivo razem z App ID i App secret.
          </li>
        </ol>
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Najczęstszy błąd: <b>różnica w slashu na końcu</b> albo <b>http</b> zamiast <b>https</b>. Skopiuj URL przyciskiem, nie przepisuj ręcznie.
            </span>
          </div>
        </div>
      </section>

      {/* === ETAP 4: Instagram === */}
      <section className="space-y-2">
        <h4 className="font-semibold">
          {t("social.meta.step4_title", "Krok 4 — Instagram (API with Instagram Login)")}
        </h4>
        <p className="text-muted-foreground">
          Instagram w Concertivo łączymy <b>osobnym flow</b>, niezależnym od Facebooka. Instagram ma własne App ID,
          App Secret, własny Redirect URI i własny token. To NIE jest token z Facebook Login for Business.
        </p>
        <ol className="ml-1 list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>
            W lewym sidebarze rozwiń <b>Use cases</b> (Przykłady użycia) i przy
            <b> „Manage messaging &amp; content on Instagram"</b> kliknij <b>Customize</b>.
            <span className="block text-xs mt-0.5">
              (Jeśli use case nie jest dodany — kliknij <b>Add use cases</b> w prawym górnym rogu i wybierz go z listy.)
            </span>
          </li>
          <li>
            Wejdź w <b>API setup with Instagram business login</b>. Zobaczysz 5 ponumerowanych sekcji.
          </li>
          <li>
            Sekcja <b>1. Generate access tokens</b> → kliknij <b>Add all required permissions</b>. Doda:
            <div className="mt-1 flex flex-wrap gap-1">
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">instagram_business_basic</code>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">instagram_business_content_publish</code>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">instagram_business_manage_comments</code>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">instagram_business_manage_messages</code>
            </div>
          </li>
          <li>
            Sekcja <b>2. Generate access tokens</b> → <b>Add account</b> → zaloguj się kontem IG <b>Business</b> lub
            <b> Creator</b>, które ma być zarządzane przez Concertivo, i autoryzuj.
          </li>
          <li>
            Sekcja <b>3. Configure webhooks</b> — <b>pomiń</b>. Concertivo synchronizuje przez polling.
          </li>
          <li>
            Sekcja <b>4. Set up Instagram business login</b> → <b>Set up</b>:
            <ul className="ml-1 mt-1 list-disc space-y-1 pl-5">
              <li>
                <b>OAuth Redirect URIs</b> — pole przyjmuje <b>tylko JEDEN URL</b>. Wpisz DOKŁADNIE:
                <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-xs">{callbackUrl}</code>
                <span className="block text-xs mt-0.5">
                  Jeśli chcesz testować z preview Lovable, tymczasowo zmień ten URL na adres preview i wróć do
                  produkcyjnego przy publikacji.
                </span>
              </li>
              <li>
                <b>Deauthorize callback URL:</b>{" "}
                <code className="break-all rounded bg-muted px-1 py-0.5 text-xs">https://{appDomain}/api/public/meta-data-deletion</code>
              </li>
              <li>
                <b>Data deletion request URL:</b>{" "}
                <code className="break-all rounded bg-muted px-1 py-0.5 text-xs">https://{appDomain}/api/public/meta-data-deletion</code>
              </li>
              <li>
                <b>Embed URL</b> (jeśli pole jest): <code className="rounded bg-muted px-1 py-0.5 text-xs">https://{appDomain}</code>
              </li>
            </ul>
            Kliknij <b>Save</b>. Krok 4 musi mieć zielony ✓.
          </li>
          <li>
            W tej samej sekcji skopiuj <b>Instagram App ID</b> oraz <b>Instagram App Secret</b> — to są <b>inne wartości</b>
            niż App ID/Secret z App Settings → Basic (które dotyczą Facebooka). Wkleisz je w formularzu Instagram w Concertivo.
          </li>
        </ol>
        <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold">Wymagania konta Instagram:</p>
              <ul className="list-disc pl-4">
                <li>Konto musi być <b>Business</b> lub <b>Creator</b> — Personal nie zadziała.</li>
                <li>Konto IG musi mieć ustawione hasło Instagrama (logowanie przez Facebooka samo w sobie nie wystarczy).</li>
                <li>
                  Jeśli konto IG jest powiązane z Facebook Page, podczas autoryzacji Meta i tak zaproponuje logowanie przez Instagram — to prawidłowe.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* === ETAP 5: Tryb testowy vs publiczny === */}
      <section className="space-y-2">
        <h4 className="font-semibold">
          {t("social.meta.step5_title", "Krok 5 — Tryb deweloperski vs Live (App Review)")}
        </h4>
        <ol className="ml-1 list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>
            Świeżo utworzona aplikacja jest w trybie <b>Development</b> — działa tylko dla <b>administratorów, deweloperów i testerów</b> aplikacji.
          </li>
          <li>
            Aby dodać kolejne osoby do testów: <b>App roles</b> → <b>Roles</b> → <b>Add people</b> → wybierz rolę <b>Tester</b> i podaj ich Facebook ID / e-mail powiązany z Facebookiem.
          </li>
          <li>
            Każda dodana osoba musi <b>zaakceptować zaproszenie</b> w swoim profilu na Facebooku (Settings → Business Integrations).
          </li>
          <li>
            Aby aplikacja działała dla wszystkich (klientów spoza zespołu), musisz przejść <b>App Review</b> — Meta sprawdzi nagranie wideo z użycia każdego scope'a. Można to zrobić później, kiedy MVP będzie gotowe.
          </li>
        </ol>
      </section>

      {/* === ETAP 6: Wklej do Concertivo === */}
      <section className="space-y-2">
        <h4 className="font-semibold">
          {t("social.meta.step6_title", "Krok 6 — Wklej dane do Concertivo i połącz")}
        </h4>
        <p className="text-xs text-muted-foreground">
          W Concertivo Facebook i Instagram mają <b>dwa osobne formularze</b> credentials — wartości są różne.
        </p>
        <div className="rounded-md border bg-background p-3 text-xs">
          <p className="font-semibold">Formularz <i>Facebook</i>:</p>
          <ul className="ml-4 mt-1 list-disc space-y-0.5 text-muted-foreground">
            <li><b>App ID</b> + <b>App Secret</b> — z App settings → Basic</li>
            <li><b>Configuration ID</b> — skopiowany z Facebook Login for Business → Configurations (Krok 3)</li>
          </ul>
          <p className="mt-2 font-semibold">Formularz <i>Instagram</i>:</p>
          <ul className="ml-4 mt-1 list-disc space-y-0.5 text-muted-foreground">
            <li><b>App ID</b> + <b>App Secret</b> — z Use cases → „Manage messaging &amp; content on Instagram" → API setup with Instagram business login (Krok 4)</li>
            <li>Configuration ID nie istnieje — pole jest ukryte.</li>
          </ul>
        </div>
        <ol className="ml-1 list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>Wklej dane do właściwego formularza i <b>Zapisz</b>.</li>
          <li>
            Kliknij <b>„Połącz z Facebook"</b> lub <b>„Połącz z Instagram"</b> — przekierujemy Cię do Meta / Instagrama.
          </li>
          <li>
            Zaloguj się i potwierdź uprawnienia. Po powrocie konto pojawi się w zakładce <b>Platformy</b>.
          </li>
        </ol>
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Gotowe. Token Instagrama jest długoterminowy (≈ 60 dni) — Concertivo odświeża go automatycznie.
            </span>
          </div>
        </div>
      </section>

      {/* === ETAP 7: Znane ograniczenia Instagram Graph API === */}
      <section className="space-y-2">
        <h4 className="font-semibold">
          {t("social.meta.step7_title", "Znane ograniczenia Instagrama (nie wina Concertivo)")}
        </h4>
        <p className="text-xs text-muted-foreground">
          Poniższe ograniczenia narzuca Meta — żadna aplikacja firm trzecich (Hootsuite, Buffer, Later) nie potrafi
          ich obejść. Nie zgłaszaj ich jako błędu Concertivo.
        </p>
        <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <b>Brak API polubień (Like)</b> dla kont biznesowych — Instagram nie udostępnia endpointu do
              polubienia posta ani komentarza w imieniu konta. Polubienia można dawać wyłącznie z aplikacji mobilnej
              IG. Próba kliknięcia „Polub" w Concertivo zwróci błąd Meta (<code>code 100, subcode 33</code>).
            </li>
            <li>
              <b>Anonimowi komentujący</b> — pole <code>username</code> komentarza jest zwracane tylko gdy
              komentujący ma konto Business/Creator. Dla kont prywatnych Meta ukrywa nick (RODO). W Concertivo
              widzisz wtedy „Użytkownik Instagrama".
            </li>
            <li>
              <b>Odpowiedzi na komentarze</b> — działają normalnie, w tym pod cudzymi komentarzami.
            </li>
          </ul>
        </div>
      </section>

      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Skrót — co musi się zgadzać:</p>
        <ul className="mt-1 list-disc pl-5 space-y-0.5">
          <li>
            <b>App domain:</b> <code className="rounded bg-background px-1 py-0.5">{appDomain}</code>
          </li>
          <li>
             <b>Redirect URI tej platformy:</b>{" "}
            <code className="break-all rounded bg-background px-1 py-0.5">{callbackUrl}</code>
          </li>
          <li>
            <b>Scopes IG:</b>{" "}
            <code className="rounded bg-background px-1 py-0.5">instagram_business_basic, instagram_business_content_publish, instagram_business_manage_comments</code>
          </li>
          <li>
            <b>Facebook:</b>{" "}
            <code className="rounded bg-background px-1 py-0.5">użyj Configuration ID z Facebook Login for Business — Concertivo nie wysyła już zaawansowanych scope’ów w parametrze scope</code>
          </li>
        </ul>
      </div>
    </div>
  );
}
