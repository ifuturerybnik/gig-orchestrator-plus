import { useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";

export const DEFAULT_BUDGET_CATEGORY_KEYS = [
  "fee",
  "transport",
  "accommodation",
  "meals",
  "equipment",
  "rental",
  "marketing",
  "venue",
  "catering",
  "ticket_sales",
  "sponsorship",
  "merch",
  "other",
] as const;

interface Props {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  existing?: Array<string | null | undefined>;
  placeholder?: string;
}

export function CategoryInput({
  id,
  value,
  onChange,
  existing = [],
  placeholder,
}: Props) {
  const { t } = useTranslation();
  const autoId = useId();
  const listId = `cat-list-${id ?? autoId}`;

  const options = useMemo(() => {
    const defaults = DEFAULT_BUDGET_CATEGORY_KEYS.map((k) =>
      t(`organizations.budget.categories.${k}`),
    );
    const fromEntries = existing
      .map((c) => (c ?? "").trim())
      .filter((c) => c.length > 0);
    return Array.from(new Set([...defaults, ...fromEntries])).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [existing, t]);

  return (
    <>
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={80}
        placeholder={placeholder ?? t("organizations.budget.categories.placeholder")}
      />
      <datalist id={listId}>
        {options.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
    </>
  );
}
