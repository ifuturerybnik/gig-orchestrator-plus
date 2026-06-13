// Awatar skrzynki widoczny tylko w aplikacji (lista skrzynek, wątki, itp.).
// Awatar widoczny u adresata w jego poczcie konfiguruje się po stronie
// serwera pocztowego (Gravatar / BIMI).
import { Mail } from "lucide-react";

export function MailboxAvatar({
  src,
  name,
  size = 40,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
}) {
  const initial = (name ?? "").trim().charAt(0).toUpperCase();
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-sm font-medium text-muted-foreground"
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : initial ? (
        <span>{initial}</span>
      ) : (
        <Mail className="h-4 w-4" />
      )}
    </div>
  );
}
