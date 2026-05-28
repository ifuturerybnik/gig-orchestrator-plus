import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  listOrgCounterparties,
  removeCounterpartyLink,
} from "@/lib/counterparty-links.functions";
import { AddCounterpartyDialog } from "@/components/organizations/AddCounterpartyDialog";
import { OrgTypesText } from "@/components/organizations/OrgTypesText";

export const Route = createFileRoute("/_authenticated/organizations/$orgId/counterparties")({
  component: OrgCounterpartiesTab,
});

function OrgCounterpartiesTab() {
  const { orgId } = Route.useParams();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const listFn = useServerFn(listOrgCounterparties);
  const removeFn = useServerFn(removeCounterpartyLink);
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["org-counterparties", orgId],
    queryFn: () => listFn({ data: { organizationId: orgId } }),
  });

  const removeMutation = useMutation({
    mutationFn: (linkId: string) => removeFn({ data: { linkId } }),
    onSuccess: () => {
      toast.success(t("organizations.counterparties.removed"));
      qc.invalidateQueries({ queryKey: ["org-counterparties", orgId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const list = data?.counterparties ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-foreground">
          {t("organizations.counterparties.section_title")}
        </h2>
        <Button onClick={() => setAddOpen(true)}>
          {t("organizations.counterparties.add_btn")}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : list.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("organizations.counterparties.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("organizations.counterparties.table.name")}</TableHead>
                <TableHead>{t("organizations.counterparties.table.types")}</TableHead>
                <TableHead>{t("organizations.counterparties.table.tax_id")}</TableHead>
                <TableHead>{t("organizations.counterparties.table.source")}</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((cp) => {
                const o = cp.organization;
                if (!o) return null;
                return (
                  <TableRow key={cp.link_id}>
                    <TableCell className="font-medium">{o.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <OrgTypesText types={o.types as string[] | null} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {o.tax_id ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={o.is_shared ? "default" : "secondary"}>
                        {o.is_shared
                          ? t("organizations.counterparties.table.source_shared")
                          : t("organizations.counterparties.table.source_private")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(t("organizations.counterparties.remove_confirm"))) {
                            removeMutation.mutate(cp.link_id);
                          }
                        }}
                        disabled={removeMutation.isPending}
                        aria-label={t("organizations.counterparties.remove")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AddCounterpartyDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        ownerOrgId={orgId}
      />
    </div>
  );
}
