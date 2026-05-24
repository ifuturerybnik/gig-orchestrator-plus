import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  formatPhone,
  parsePhone,
  pickDefaultCountry,
  sortedCountries,
  type CountryCode,
} from "@/lib/countries";

interface PhoneInputProps {
  /** Pełny numer w formacie "+48 123 456 789" lub pusty string. */
  value: string;
  onChange: (value: string) => void;
  /** Kraj z profilu (np. address_country) — używany jako domyślny prefiks. */
  defaultCountry?: string | null;
  id?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Globalny input telefonu z wyborem prefiksu kraju.
 * Domyślny kraj: profileCountry → język UI → "PL".
 */
export function PhoneInput({
  value,
  onChange,
  defaultCountry,
  id,
  placeholder,
  required,
  disabled,
}: PhoneInputProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language || "pl";

  const fallback = useMemo(
    () => pickDefaultCountry(defaultCountry, lang),
    [defaultCountry, lang],
  );

  const parsed = parsePhone(value);
  const [country, setCountry] = useState<CountryCode>(parsed?.country ?? fallback);
  const [national, setNational] = useState<string>(parsed?.national ?? "");

  // Sync przy zmianie value z zewnątrz (np. po fetchu profilu).
  useEffect(() => {
    const p = parsePhone(value);
    if (p) {
      setCountry(p.country);
      setNational(p.national);
    } else if (!value) {
      setNational("");
    }
    // intentionally only react to value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Gdy nie ma jeszcze numeru a zmienia się defaultCountry (np. po wczytaniu profilu),
  // zaktualizuj prefiks domyślny.
  useEffect(() => {
    if (!national && !value) setCountry(fallback);
  }, [fallback, national, value]);

  const emit = (c: CountryCode, n: string) => {
    onChange(n ? formatPhone(c, n) : "");
  };

  const options = useMemo(() => sortedCountries(lang), [lang]);

  return (
    <div className="flex gap-2">
      <Select
        value={country}
        onValueChange={(c) => {
          setCountry(c);
          emit(c, national);
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-[130px] shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.code} +{c.dial}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        value={national}
        onChange={(e) => {
          const n = e.target.value;
          setNational(n);
          emit(country, n);
        }}
      />
    </div>
  );
}
