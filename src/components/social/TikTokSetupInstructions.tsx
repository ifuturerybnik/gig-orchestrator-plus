import { ExternalLink } from "lucide-react";

export function TikTokSetupInstructions({ callbackUrl }: { callbackUrl: string }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        TikTok używa własnego OAuth. Każda organizacja zakłada aplikację w TikTok for
        Developers — Concertivo nie ma wglądu w Twoje konto.
      </p>
      <ol className="ml-5 list-decimal space-y-2">
        <li>
          Otwórz{" "}
          <a
            href="https://developers.tiktok.com/apps"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            TikTok for Developers <ExternalLink className="inline h-3 w-3" />
          </a>{" "}
          i kliknij <b>Manage apps → Connect an app</b>.
        </li>
        <li>
          W aplikacji dodaj produkty <b>Login Kit</b> oraz <b>Content Posting API</b>.
          W Login Kit zaznacz scopes:
          <code className="ml-1 block break-all rounded bg-muted px-1.5 py-1 text-xs">
            user.info.basic
            <br />
            video.upload
            <br />
            video.publish
            <br />
            video.list
          </code>
        </li>
        <li>
          W polu <b>Redirect URI</b> wklej:
          <code className="ml-1 block break-all rounded bg-muted px-1.5 py-1 text-xs">
            {callbackUrl}
          </code>
        </li>
        <li>
          W zakładce <b>Sandbox</b> dodaj swoje konto TikTok jako test user (zanim
          przejdziesz App Review — tylko test users mogą się autoryzować).
        </li>
        <li>
          Skopiuj <b>Client Key</b> (wklej jako „Client ID") oraz <b>Client Secret</b>
          {" "}poniżej.
        </li>
      </ol>
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        <b>Ważne:</b> przed App Review filmy publikowane przez API trafiają do
        skrzynki użytkownika w aplikacji TikTok („SEND_TO_USER_INBOX") i wymagają
        ręcznego zatwierdzenia. Po App Review publikacja działa w pełni
        automatycznie.
      </div>
    </div>
  );
}
