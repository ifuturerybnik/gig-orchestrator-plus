import { useTranslation } from "react-i18next";

/**
 * Renderuje listę typów organizacji jako lokalizowany tekst po przecinku.
 * Backwards-compat: jeśli przekazany pojedynczy string `type` (legacy), też zadziała.
 */
export function OrgTypesText({
  types,
  legacyType,
  fallback = "—",
}: {
  types?: readonly string[] | null;
  legacyType?: string | null;
  fallback?: string;
}) {
  const { t } = useTranslation();
  const arr = (types && types.length > 0)
    ? Array.from(types)
    : legacyType
      ? [legacyType]
      : [];
  if (arr.length === 0) return <span>{fallback}</span>;
  return (
    <span>
      {arr
        .map((t1) => t(`organizations.type.${t1}`, { defaultValue: t1 }))
        .join(", ")}
    </span>
  );
}
