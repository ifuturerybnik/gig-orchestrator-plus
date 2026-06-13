import { Moon, Sun, Monitor } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme, type Theme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{ value: Theme; Icon: typeof Sun; labelKey: string }> = [
  { value: "light", Icon: Sun, labelKey: "theme.light" },
  { value: "dark", Icon: Moon, labelKey: "theme.dark" },
  { value: "auto", Icon: Monitor, labelKey: "theme.auto" },
];

export function ThemeSwitcher() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  return (
    <div
      role="group"
      aria-label={t("theme.label")}
      className="inline-flex h-8 items-center rounded-md border border-input bg-background p-0.5"
    >
      {OPTIONS.map(({ value, Icon, labelKey }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={active}
            title={t(labelKey)}
            aria-label={t(labelKey)}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded transition-colors",
              active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
