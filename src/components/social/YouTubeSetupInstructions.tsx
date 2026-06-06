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
          Wklej oba pola poniżej.
        </li>
      </ol>
      <p className="text-xs text-muted-foreground">
        Uwaga: domyślna kwota YouTube API to 10 000 jednostek dziennie. Jeden upload
        kosztuje 1 600 jednostek (≈6 filmów/dzień). Jeśli potrzebujesz więcej —
        poproś Google o zwiększenie kwoty.
      </p>
    </div>
  );
}
