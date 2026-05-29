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
            href="https://console.cloud.google.com/apis/dashboard"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            Google Cloud Console <ExternalLink className="inline h-3 w-3" />
          </a>{" "}
          i utwórz projekt (lub wybierz istniejący).
        </li>
        <li>
          W „APIs &amp; Services → Library" włącz <b>YouTube Data API v3</b>.
        </li>
        <li>
          W „APIs &amp; Services → OAuth consent screen" wybierz <b>External</b>, wypełnij
          nazwę, e-mail wsparcia. W sekcji <b>Scopes</b> dodaj:
          <code className="ml-1 block break-all rounded bg-muted px-1.5 py-1 text-xs">
            https://www.googleapis.com/auth/youtube.upload
            <br />
            https://www.googleapis.com/auth/youtube.readonly
            <br />
            https://www.googleapis.com/auth/youtube.force-ssl
          </code>
          W sekcji <b>Test users</b> dodaj swój e-mail Google (zanim app przejdzie
          weryfikację Google, tylko test users mogą się autoryzować).
        </li>
        <li>
          W „APIs &amp; Services → Credentials" kliknij <b>Create Credentials → OAuth client ID</b>
          , typ <b>Web application</b>. W polu <b>Authorized redirect URIs</b> wklej:
          <code className="ml-1 block break-all rounded bg-muted px-1.5 py-1 text-xs">
            {callbackUrl}
          </code>
        </li>
        <li>
          Skopiuj <b>Client ID</b> i <b>Client Secret</b> i wklej je poniżej.
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
