import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Domyślne kategorie dostępne w polu wyboru (Budżet / Przyszłe wydatki).
 * Pozostałe presety zostały świadomie ograniczone — użytkownik może dodać
 * własną kategorię przez opcję "Inne (wpisz własną)".
 */
export const DEFAULT_BUDGET_CATEGORY_KEYS = [
  "marketing",
  "merch",
  "accommodation",
  "music_videos",
  "other",
] as const;

const OTHER_SENTINEL = "__other__";
const STORAGE_PREFIX = "concertivo.categories.";

interface Props {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  existing?: Array<string | null | undefined>;
  storageKey?: string;
}

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
  storageKey,
}: Props) {
  const { t } = useTranslation();

  const presetLabels = useMemo(
    () =>
      DEFAULT_BUDGET_CATEGORY_KEYS.map((k) =>
        t(`organizations.budget.categories.${k}`),
      ),
    [t],
  );
  const otherLabel = t("organizations.budget.categories.other");

  const [local, setLocal] = useState<string[]>(() => readLocal(storageKey));
  useEffect(() => {
    setLocal(readLocal(storageKey));
  }, [storageKey]);

  const customs = useMemo(() => {
    const fromEntries = existing
      .map((c) => (c ?? "").trim())
      .filter((c) => c.length > 0);
    return Array.from(new Set([...fromEntries, ...local]))
      .filter((c) => !presetLabels.includes(c))
      .sort((a, b) => a.localeCompare(b));
  }, [existing, local, presetLabels]);

  const knownValues = useMemo(
    () => [...presetLabels, ...customs],
    [presetLabels, customs],
  );

  // Tryb "inne" włączamy gdy wartość nie należy do żadnej zapamiętanej kategorii
  // (z wyjątkiem pustej — wtedy nic nie jest jeszcze wybrane).
  const [otherMode, setOtherMode] = useState<boolean>(
    value !== "" && !knownValues.includes(value),
  );

  useEffect(() => {
    if (value !== "" && !knownValues.includes(value)) {
      setOtherMode(true);
    }
  }, [value, knownValues]);

  const selectValue = otherMode
    ? OTHER_SENTINEL
    : knownValues.includes(value)
      ? value
      : "";

  const handleSelectChange = (v: string) => {
    if (v === OTHER_SENTINEL) {
      setOtherMode(true);
      onChange("");
    } else {
      setOtherMode(false);
      onChange(v);
    }
  };

  const persist = () => {
    const v = value.trim();
    if (!v || !storageKey) return;
    if (presetLabels.includes(v) || local.includes(v)) return;
    const next = Array.from(new Set([...local, v])).slice(-100);
    setLocal(next);
    writeLocal(storageKey, next);
  };

  return (
    <div className="space-y-2">
      <Select value={selectValue} onValueChange={handleSelectChange}>
        <SelectTrigger id={id}>
          <SelectValue
            placeholder={t("organizations.budget.categories.placeholder")}
          />
        </SelectTrigger>
        <SelectContent>
          {customs.length > 0 && (
            <>
              {customs.map((c) => (
                <SelectItem key={`c-${c}`} value={c}>
                  {c}
                </SelectItem>
              ))}
              <SelectSeparator />
            </>
          )}
          {DEFAULT_BUDGET_CATEGORY_KEYS.filter((k) => k !== "other").map((k) => {
            const label = t(`organizations.budget.categories.${k}`);
            return (
              <SelectItem key={k} value={label}>
                {label}
              </SelectItem>
            );
          })}
          <SelectSeparator />
          <SelectItem value={OTHER_SENTINEL}>
            {t("organizations.budget.categories.other_custom")}
          </SelectItem>
        </SelectContent>
      </Select>

      {otherMode && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={persist}
          maxLength={80}
          placeholder={
            t("organizations.budget.categories.custom_placeholder") ||
            otherLabel
          }
          autoFocus
        />
      )}
    </div>
  );
}
