import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";

/**
 * Łopatologiczna instrukcja krok-po-kroku tworzenia aplikacji LinkedIn
 * w LinkedIn Developer Portal i uzyskania Client ID + Client Secret.
 */
export function LinkedInSetupInstructions({ callbackUrl }: { callbackUrl: string }) {
  const { t } = useTranslation();

  const steps = t("social.setup.linkedin.steps", {
    returnObjects: true,
    defaultValue: [] as string[],
  }) as string[];

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">{t("social.setup.linkedin.intro")}</p>

      <a
        href="https://www.linkedin.com/developers/apps"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {t("social.setup.linkedin.open_portal")}
      </a>

      <ol className="ml-1 list-decimal space-y-3 pl-5">
        {steps.map((step, i) => (
          <li
            key={i}
            className="text-sm leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: step.replace(
                "{CALLBACK_URL}",
                `<code class="rounded bg-muted px-1.5 py-0.5 text-xs font-mono break-all">${callbackUrl}</code>`,
              ),
            }}
          />
        ))}
      </ol>

      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        <strong>{t("social.setup.linkedin.tip_label")}:</strong>{" "}
        {t("social.setup.linkedin.tip_body")}
      </div>
    </div>
  );
}
