import { Megaphone } from "lucide-react";

/**
 * Panel „e-Doręczenia zbiorowe” — wysyłka masowa z jednej skrzynki ADE.
 * Widoczny tylko dla organizacji, którym administrator nadał dostęp.
 */
export default function EdoreczeniaBulk({ orgId }: { orgId: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-6">
      <div className="flex items-start gap-3">
        <Megaphone className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <h2 className="text-base font-semibold text-foreground">
            e-Doręczenia zbiorowe
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Moduł wysyłki masowej dla tej organizacji jest aktywny. Kolejne kroki
            (wybór listy odbiorców, szablon wiadomości i harmonogram wysyłki)
            dodamy tutaj.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">ID organizacji: {orgId}</p>
        </div>
      </div>
    </div>
  );
}
