import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.language)
    ? i18n.language
    : "pl";

  return (
    <Select value={current} onValueChange={(value) => i18n.changeLanguage(value)}>
      <SelectTrigger className="w-[120px]" aria-label={t("lang.label")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LANGUAGES.map((lng) => (
          <SelectItem key={lng} value={lng}>
            {t(`lang.${lng}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
