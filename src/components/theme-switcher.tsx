import { Moon, Sun, Monitor } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme, type Theme } from "@/hooks/use-theme";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ThemeSwitcher() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  return (
    <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
      <SelectTrigger className="w-[120px]" aria-label={t("theme.label")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light">
          <span className="inline-flex items-center gap-2">
            <Sun className="h-4 w-4" /> {t("theme.light")}
          </span>
        </SelectItem>
        <SelectItem value="dark">
          <span className="inline-flex items-center gap-2">
            <Moon className="h-4 w-4" /> {t("theme.dark")}
          </span>
        </SelectItem>
        <SelectItem value="auto">
          <span className="inline-flex items-center gap-2">
            <Monitor className="h-4 w-4" /> {t("theme.auto")}
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
