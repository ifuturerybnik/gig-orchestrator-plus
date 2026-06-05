import { useTranslation } from "react-i18next";
import { ExternalLink, AlertTriangle, Info, CheckCircle2 } from "lucide-react";

/**
 * Łopatologiczna instrukcja konfiguracji aplikacji Meta (Facebook + Instagram)
 * dla Concertivo. Spisana na podstawie udanej integracji produkcyjnej.
 *
 * Ważne fakty, które już zostały zweryfikowane w boju:
 *  - Instagram może działać przez nowe Instagram Login albo przez Facebook Login for Business
 *    dla Page-connected IG. Moderacja komentarzy wymaga osobnego scope'a w każdym flow.
 *  - Wymagane scope'y to: instagram_business_basic, instagram_business_content_publish, instagram_business_manage_comments.
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
              {t("social.meta.intro_title", "Jedna aplikacja Meta = Facebook + Instagram")}
            </p>
            <p className="mt-1">
              {t(
                "social.meta.intro_body",
                "Tworzysz JEDNĄ aplikację w Meta for Developers i używasz tego samego App ID / App Secret do logowania Facebooka i Instagrama. Wystarczy raz przejść konfigurację.",
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
        <ol className="ml-1 list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>
            W menu po lewej kliknij <b>Add product</b> i przy <b>Facebook Login for Business</b> kliknij <b>Set up</b>.
          </li>
          <li>
            Wejdź w <b>Facebook Login for Business</b> → <b>Settings</b>.
          </li>
          <li>
            <b>Client OAuth login:</b> <b>Yes</b>
          </li>
          <li>
            <b>Web OAuth login:</b> <b>Yes</b>
          </li>
          <li>
            <b>Enforce HTTPS:</b> <b>Yes</b>
          </li>
          <li>
            <b>Valid OAuth Redirect URIs</b> — wklej DOKŁADNIE ten adres (musi się zgadzać co do znaku):
            <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-xs">{callbackUrl}</code>
          </li>
          <li>
            Kliknij <b>Save changes</b>.
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
          {t("social.meta.step4_title", "Krok 4 — Instagram (Business Login for Instagram)")}
        </h4>
        <p className="text-muted-foreground">
          Instagram może być połączony bezpośrednio przez <i>Instagram API with Instagram Login</i> albo razem z Fanpage’em
          przez <i>Facebook Login for Business</i>. Do komentarzy potrzebne jest uprawnienie zarządzania komentarzami.
        </p>
        <ol className="ml-1 list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>
            W menu po lewej kliknij <b>Add product</b> i przy <b>Instagram</b> kliknij <b>Set up</b>.
          </li>
          <li>
            Wejdź w <b>Instagram</b> → <b>API setup with Instagram login</b>.
          </li>
          <li>
            W sekcji <b>2. Generate access tokens</b> kliknij <b>Add account</b> i połącz konto Instagram <b>Business</b> lub <b>Creator</b>, którym chcesz zarządzać przez Concertivo.
          </li>
          <li>
            W sekcji <b>3. Configure webhooks</b> możesz na razie pominąć (Concertivo synchronizuje po API).
          </li>
          <li>
            W sekcji <b>4. Set up Instagram business login</b> kliknij <b>Set up</b>:
            <ul className="ml-1 mt-1 list-disc space-y-1 pl-5">
              <li>
                <b>OAuth redirect URI:</b> wklej DOKŁADNIE:
                <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-xs">{callbackUrl}</code>
              </li>
              <li>
                <b>Deauthorize callback URL</b> i <b>Data deletion request URL:</b> możesz wpisać{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">https://{appDomain}/privacy</code>{" "}
                (Meta tego wymaga, ale dla MVP wystarczy strona polityki).
              </li>
              <li>
                <b>Permissions</b> — zaznacz minimum:
                <div className="mt-1 flex flex-wrap gap-1">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">instagram_business_basic</code>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">instagram_business_content_publish</code>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">instagram_business_manage_comments</code>
                </div>
              </li>
            </ul>
          </li>
          <li>
            Kliknij <b>Save changes</b>.
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
        <ol className="ml-1 list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>
            Wróć do tego okna i w formularzu powyżej wklej <b>App ID</b> i <b>App secret</b>, zapisz.
          </li>
          <li>
            Kliknij <b>„Połącz z Facebook"</b> lub <b>„Połącz z Instagram"</b> — przekierujemy Cię do Meta.
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

      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Skrót — co musi się zgadzać:</p>
        <ul className="mt-1 list-disc pl-5 space-y-0.5">
          <li>
            <b>App domain:</b> <code className="rounded bg-background px-1 py-0.5">{appDomain}</code>
          </li>
          <li>
            <b>Redirect URI (FB + IG, identyczny):</b>{" "}
            <code className="break-all rounded bg-background px-1 py-0.5">{callbackUrl}</code>
          </li>
          <li>
            <b>Scopes IG:</b>{" "}
            <code className="rounded bg-background px-1 py-0.5">instagram_business_basic, instagram_business_content_publish, instagram_business_manage_comments</code>
          </li>
          <li>
            <b>Scopes FB:</b>{" "}
            <code className="rounded bg-background px-1 py-0.5">pages_show_list, pages_read_engagement, pages_manage_posts, pages_manage_metadata, business_management, instagram_basic, instagram_content_publish, instagram_manage_comments</code>
          </li>
        </ul>
      </div>
    </div>
  );
}
