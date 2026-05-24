import { useEffect, useId, useMemo, useState } from "react";
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
  /** Klucz w localStorage do trwałego zapamiętywania nowych kategorii (np. orgId). */
  storageKey?: string;
}

const STORAGE_PREFIX = "concertivo.categories.";

function readLocal(key?: string): string[] {
  if (!key || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeLocal(key: string, list: string[]) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function CategoryInput({
  id,
  value,
  onChange,
  existing = [],
  placeholder,
  storageKey,
}: Props) {
  const { t } = useTranslation();
  const autoId = useId();
  const listId = `cat-list-${id ?? autoId}`;

  const [local, setLocal] = useState<string[]>(() => readLocal(storageKey));
  useEffect(() => {
    setLocal(readLocal(storageKey));
  }, [storageKey]);

  const options = useMemo(() => {
    const defaults = DEFAULT_BUDGET_CATEGORY_KEYS.map((k) =>
      t(`organizations.budget.categories.${k}`),
    );
    const fromEntries = existing
      .map((c) => (c ?? "").trim())
      .filter((c) => c.length > 0);
    return Array.from(new Set([...defaults, ...fromEntries, ...local])).sort(
      (a, b) => a.localeCompare(b),
    );
  }, [existing, local, t]);

  const persist = () => {
    const v = value.trim();
    if (!v || !storageKey) return;
    if (options.includes(v)) return;
    const next = Array.from(new Set([...local, v])).slice(-100);
    setLocal(next);
    writeLocal(storageKey, next);
  };

  return (
    <>
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={persist}
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
