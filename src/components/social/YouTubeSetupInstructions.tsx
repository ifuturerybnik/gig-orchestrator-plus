import { ExternalLink } from "lucide-react";

export function YouTubeSetupInstructions({ callbackUrl }: { callbackUrl: string }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        YouTube używa Google OAuth 2.0. Każda organizacja konfiguruje własny projekt w
        Google Cloud Console — Concertivo nie ma wglądu w Twój kanał.
      </p>
      <ol className="ml-5 list-decimal space-y-2">
        <li>
          Otwórz{" "}
          <a
            href="https://console.cloud.google.com/"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            Google Cloud Console <ExternalLink className="inline h-3 w-3" />
          </a>{" "}
          i utwórz nowy projekt (lub wybierz istniejący).
        </li>
        <li>
          Włącz <b>YouTube Data API v3</b>: przejdź do{" "}
          <i>APIs &amp; Services → Library</i>, wyszukaj „YouTube Data API v3" i kliknij <b>Enable</b>.
        </li>
        <li>
          Przejdź do <i>APIs &amp; Services → OAuth consent screen</i> (obecnie nazywane{" "}
          <b>Platforma uwierzytelniania Google</b>).
          Kliknij <b>Utwórz</b> / <b>Rozpocznij</b> i przejdź przez kroki:
          <ol className="ml-5 mt-1 list-[lower-alpha] space-y-1">
            <li>
              <b>Informacje o aplikacji</b> — Nazwa: <code>Concertivo</code>; E-mail wsparcia: Twój adres Google.
            </li>
            <li>
              <b>Odbiorcy</b> — wybierz <b>Zewnętrzni (External)</b>.
            </li>
            <li>
              <b>Dane kontaktowe</b> — wpisz ten sam e-mail.
            </li>
            <li>
              <b>Zakończ</b> — zaakceptuj warunki i utwórz.
            </li>
          </ol>
        </li>
        <li>
          Dodaj zakresy YouTube: w lewym menu kliknij <b>Dostęp do danych</b> →{" "}
          <b>Dodaj lub usuń zakresy</b>. W filtrze wpisz <code>youtube</code> i zaznacz:
          <code className="ml-1 block break-all rounded bg-muted px-1.5 py-1 text-xs">
            https://www.googleapis.com/auth/youtube.upload
            <br />
            https://www.googleapis.com/auth/youtube.readonly
            <br />
            https://www.googleapis.com/auth/youtube.force-ssl
          </code>
        </li>
        <li>
          Dodaj użytkownika testowego: w lewym menu kliknij <b>Odbiorcy</b> → w sekcji{" "}
          <b>Użytkownicy testowi</b> dodaj swój e-mail Google. Bez tego Google zablokuje logowanie
          zanim aplikacja przejdzie weryfikację.
        </li>
        <li>
          Utwórz Client ID: na górze strony kliknij <b>Utwórz klienta OAuth</b> (lub przejdź do{" "}
          <i>Credentials → Create Credentials → OAuth client ID</i>).
          Wybierz typ <b>Aplikacja internetowa</b>.
          W sekcji <b>Autoryzowane identyfikatory URI przekierowania</b> kliknij <b>Dodaj URI</b> i wklej:
          <code className="ml-1 block break-all rounded bg-muted px-1.5 py-1 text-xs">
            {callbackUrl}
          </code>
          (dodaj też wersję produkcyjną, np.{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">https://concertivo.eu/api/public/social/youtube-callback</code>, jeśli masz już domenę).
        </li>
        <li>
          Skopiuj <b>Identyfikator klienta</b> i <b>Tajny klucz klienta</b>.
          Identyfikator to losowy ciąg znaków (np. 12 cyfr + myślnik + znaki) kończący się{" "}
          <code>.apps.googleusercontent.com</code> — to normalny format.
          Wklej oba pola poniżej i — jeśli Twój projekt jest w trybie <b>Testing</b> —
          zaznacz odpowiednią opcję pod formularzem.
        </li>
      </ol>

      <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-xs dark:border-sky-900 dark:bg-sky-950/40">
        <div className="font-semibold text-sky-900 dark:text-sky-100">
          Tryb Testing vs Production — co wybrać?
        </div>
        <ul className="ml-5 mt-1 list-disc space-y-1 text-sky-900/90 dark:text-sky-100/90">
          <li>
            <b>Testing</b> (domyślny po utworzeniu projektu): działa od razu, ale{" "}
            <b>refresh_token wygasa co 7 dni</b> i trzeba klikać „Połącz ponownie".
            Max 100 użytkowników testowych.
          </li>
          <li>
            <b>Production</b>: bez wygasania, ale dla zakresów{" "}
            <code>youtube.upload</code> / <code>youtube.force-ssl</code>{" "}
            Google wymaga <b>weryfikacji aplikacji</b> (formularz + nagranie wideo,
            ok. 4–6 tygodni).
          </li>
        </ul>
      </div>

      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs dark:border-emerald-900 dark:bg-emerald-950/40">
        <div className="font-semibold text-emerald-900 dark:text-emerald-100">
          Chcesz przejść z Testing → Production (bez 7-dniowego limitu)?
        </div>
        <ol className="ml-5 mt-1 list-decimal space-y-1 text-emerald-900/90 dark:text-emerald-100/90">
          <li>
            W Google Cloud Console: <i>APIs &amp; Services → OAuth consent screen</i>{" "}
            → <b>Publish App</b>.
          </li>
          <li>
            Otwórz formularz <b>Verification Center</b>. Wymagane będą m.in.:
            <ul className="ml-5 mt-0.5 list-[circle] space-y-0.5">
              <li>Link do publicznej polityki prywatności i regulaminu.</li>
              <li>Link do publicznej strony domowej aplikacji.</li>
              <li>Nagranie wideo (max 5 min) pokazujące przebieg OAuth oraz każdy używany zakres.</li>
              <li>Uzasadnienie dla zakresów wrażliwych <code>youtube.upload</code> i <code>youtube.force-ssl</code>.</li>
            </ul>
          </li>
          <li>
            Weryfikacja trwa ok. <b>4–6 tygodni</b>. W tym czasie aplikacja działa
            normalnie w Testing dla użytkowników testowych.
          </li>
          <li>
            Po zatwierdzeniu — wróć tutaj i <b>odznacz</b> opcję „Tryb OAuth Testing".
            Token od tej pory przestaje wygasać po 7 dniach.
          </li>
        </ol>
      </div>

      <p className="text-xs text-muted-foreground">
        Uwaga: domyślna kwota YouTube API to 10 000 jednostek dziennie. Jeden upload
        kosztuje 1 600 jednostek (≈6 filmów/dzień). Jeśli potrzebujesz więcej —
        poproś Google o zwiększenie kwoty.
      </p>
    </div>
  );
}
