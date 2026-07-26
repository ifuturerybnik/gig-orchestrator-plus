// Placeholder wspólnego komponentu skrzynki dla user/org.
// W kolejnej fazie zostanie tu zmigrowany EdoreczeniaInboxTab z pełnym mechanizmem.
// Obecnie: wyświetla listę skonfigurowanych skrzynek scope + informację, że
// obsługa wiadomości dla user/org jest w trakcie migracji na multi-tenant.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Loader2, Inbox, Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listAdeMailboxes, type AdeMailboxScope } from "@/lib/ade-mailboxes.functions";

type Props = { scope: AdeMailboxScope; setupHref: string };

export default function EdoreczeniaInbox({ scope, setupHref }: Props) {
  const listFn = useServerFn(listAdeMailboxes);
  const scopeKey = useMemo(() => JSON.stringify(scope), [scope]);
  const q = useQuery({
    queryKey: ["ade-mailboxes", scopeKey],
    queryFn: () => listFn({ data: { scope } }),
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Ładowanie skrzynek…
      </div>
    );
  }

  const mailboxes = q.data ?? [];
  if (mailboxes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            e-Doręczenia
          </CardTitle>
          <CardDescription>
            Nie masz jeszcze skonfigurowanej skrzynki e-Doręczeń dla tego kontekstu.
            Wgraj certyfikat QWAC i podaj dane skrzynki w ustawieniach.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to={setupHref}>
              <Settings2 className="h-4 w-4 mr-2" />
              Skonfiguruj skrzynkę
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="h-5 w-5" />
          e-Doręczenia
        </CardTitle>
        <CardDescription>
          Skrzynki skonfigurowane. Pełny widok skrzynki (odbieranie, wysyłanie, foldery) jest już dostępny w
          panelu <b>Administracja → e-Doręczenia</b>. Widok dla tego kontekstu zostanie udostępniony po
          zakończeniu migracji integracji na multi-tenant.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {mailboxes.map((mb) => (
          <div key={mb.id} className="rounded-md border border-border p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">{mb.label || mb.mailboxAddress}</span>
              <Badge variant="outline">{mb.adeEnv}</Badge>
              {!mb.isActive && <Badge variant="secondary">Wyłączona</Badge>}
            </div>
            <div className="text-xs text-muted-foreground font-mono mt-1">{mb.mailboxAddress}</div>
          </div>
        ))}
        <div>
          <Button asChild variant="outline" size="sm">
            <Link to={setupHref}>
              <Settings2 className="h-4 w-4 mr-2" />
              Zarządzaj skrzynkami
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
