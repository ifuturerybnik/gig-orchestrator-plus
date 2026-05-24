import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sortedCurrencies } from "@/lib/currencies";

interface CurrencySelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function CurrencySelect({ id, value, onChange, disabled }: CurrencySelectProps) {
  const { i18n } = useTranslation();
  const list = useMemo(() => sortedCurrencies(i18n.language), [i18n.language]);
  const isPl = i18n.language.startsWith("pl");

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {list.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            <span className="font-mono text-xs text-muted-foreground mr-2">{c.code}</span>
            {isPl ? c.name_pl : c.name_en}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
