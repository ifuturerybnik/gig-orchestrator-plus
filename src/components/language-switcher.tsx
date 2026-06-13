import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import { cn } from "@/lib/utils";

const SHORT: Record<string, string> = { pl: "PL", en: "ENG" };

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.language)
    ? i18n.language
    : "pl";

  return (
    <div
      role="group"
      aria-label={t("lang.label")}
      className="inline-flex h-8 items-center rounded-md border border-input bg-background p-0.5"
    >
      {SUPPORTED_LANGUAGES.map((lng) => {
        const active = current === lng;
        return (
          <button
            key={lng}
            type="button"
            onClick={() => i18n.changeLanguage(lng)}
            aria-pressed={active}
            title={t(`lang.${lng}`)}
            className={cn(
              "h-7 px-2 rounded text-xs font-medium transition-colors",
              active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {SHORT[lng] ?? lng.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
