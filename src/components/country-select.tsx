import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pickDefaultCountry, sortedCountries, type CountryCode } from "@/lib/countries";

interface CountrySelectProps {
  /** ISO-2 (np. "PL") lub pusty string. */
  value: string;
  onChange: (value: CountryCode) => void;
  /** Sugerowany kraj jeśli value jest puste — np. address_country z profilu. */
  suggestedCountry?: string | null;
  /** Czy ustawić sugestię automatycznie gdy value jest puste (domyślnie true). */
  autoApplySuggestion?: boolean;
  id?: string;
  disabled?: boolean;
}

/**
 * Globalny select kraju. Domyślnie sugeruje kraj wg priorytetu:
 * suggestedCountry → język UI → "PL".
 */
export function CountrySelect({
  value,
  onChange,
  suggestedCountry,
  autoApplySuggestion = true,
  id,
  disabled,
}: CountrySelectProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language || "pl";

  const suggestion = useMemo(
    () => pickDefaultCountry(suggestedCountry, lang),
    [suggestedCountry, lang],
  );

  // Auto-zastosuj sugestię tylko gdy pole jest puste.
  useEffect(() => {
    if (autoApplySuggestion && !value && suggestion) {
      onChange(suggestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion, autoApplySuggestion]);

  const options = useMemo(() => sortedCountries(lang), [lang]);

  return (
    <Select value={value || suggestion} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            {lang.startsWith("pl") ? c.name_pl : c.name_en}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
