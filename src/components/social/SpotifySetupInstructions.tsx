import { ExternalLink } from "lucide-react";

export function SpotifySetupInstructions({ callbackUrl }: { callbackUrl: string }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        Spotify to integracja <b>read-only</b> — pobieramy statystyki profilu (liczbę
        obserwujących, popularność wykonawcy). Spotify nie udostępnia API do
        publikacji ani komentarzy.
      </p>
      <ol className="ml-5 list-decimal space-y-2">
        <li>
          Otwórz{" "}
          <a
            href="https://developer.spotify.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            Spotify Developer Dashboard <ExternalLink className="inline h-3 w-3" />
          </a>{" "}
          i kliknij <b>Create app</b>.
        </li>
        <li>
          Uzupełnij nazwę i opis aplikacji. W polu <b>Redirect URI</b> wklej:
          <code className="ml-1 block break-all rounded bg-muted px-1.5 py-1 text-xs">
            {callbackUrl}
          </code>
        </li>
        <li>
          W zakładce <b>APIs used</b> zaznacz <b>Web API</b>.
        </li>
        <li>
          Zapisz aplikację, otwórz <b>Settings</b> i skopiuj <b>Client ID</b> oraz{" "}
          <b>Client Secret</b> — wklej je poniżej.
        </li>
        <li>
          Po zapisaniu kliknij „Połącz", zaloguj się na konto Spotify powiązane z
          profilem artysty. Concertivo poprosi o uprawnienia tylko do odczytu
          (profil + top wykonawcy).
        </li>
      </ol>
      <div className="rounded-md border border-blue-300 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        <b>Wskazówka:</b> w trybie deweloperskim Spotify pozwala autoryzować się
        tylko kontom dodanym w sekcji <b>Users and Access</b>. Dla użytku
        produkcyjnego wymagana jest tzw. „Quota Extension" — wniosek przez
        formularz Spotify.
      </div>
    </div>
  );
}
