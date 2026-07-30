import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { listBulkAccessOrgs, setBulkAccess } from "@/lib/edoreczenia-bulk.functions";

export default function EdoreczeniaAccessTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const fetchOrgs = useServerFn(listBulkAccessOrgs);
  const toggle = useServerFn(setBulkAccess);

  const orgsQuery = useQuery({
    queryKey: ["edoreczenia-bulk-access"],
    queryFn: () => fetchOrgs(),
  });

  const mutation = useMutation({
    mutationFn: (vars: { organizationId: string; enabled: boolean }) =>
      toggle({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["edoreczenia-bulk-access"] });
      toast.success("Zaktualizowano dostęp");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Błąd zapisu"),
  });

  const orgs = (orgsQuery.data?.organizations ?? []).filter((o) =>
    o.name.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Dostęp do e-Doręczeń zbiorowych
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Zaznacz organizacje, którym udostępniasz podzakładkę „e-Doręczenia
          zbiorowe”.
        </p>
      </div>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Szukaj organizacji…"
        className="max-w-sm"
      />

      {orgsQuery.isLoading && (
        <p className="text-sm text-muted-foreground">Ładowanie…</p>
      )}
      {orgsQuery.error && (
        <p className="text-sm text-destructive">
          {(orgsQuery.error as Error).message}
        </p>
      )}

      <div className="divide-y divide-border rounded-md border border-border bg-card">
        {orgs.map((o) => (
          <div key={o.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {o.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {o.status}
                {o.grantedAt
                  ? ` • dostęp od ${new Date(o.grantedAt).toLocaleDateString("pl-PL")}`
                  : ""}
              </p>
            </div>
            <Switch
              checked={o.hasAccess}
              disabled={mutation.isPending}
              onCheckedChange={(v) =>
                mutation.mutate({ organizationId: o.id, enabled: v })
              }
            />
          </div>
        ))}
        {!orgsQuery.isLoading && orgs.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Brak organizacji.
          </p>
        )}
      </div>
    </div>
  );
}
