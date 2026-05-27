import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { HelpCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link } from "@tanstack/react-router";
import { listMyOrganizations, deleteOrganization } from "@/lib/organizations.functions";
import {
  listMyCounterparties,
  removeCounterpartyLink,
} from "@/lib/counterparty-links.functions";
import { RegisterOrgDialog } from "@/components/organizations/RegisterOrgDialog";
import { AddCounterpartyDialog } from "@/components/organizations/AddCounterpartyDialog";
import { CounterpartyDetailsDialog } from "@/components/organizations/CounterpartyDetailsDialog";
import { OrgTypesText } from "@/components/organizations/OrgTypesText";

export const Route = createFileRoute("/_authenticated/organizations/")({
  component: OrganizationsListPage,
});

function OrganizationsListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fetchOrgs = useServerFn(listMyOrganizations);
  const fetchCounterparties = useServerFn(listMyCounterparties);
  const removeFn = useServerFn(removeCounterpartyLink);
  const deleteOrgFn = useServerFn(deleteOrganization);

  const { data, isLoading } = useQuery({
    queryKey: ["my-organizations"],
    queryFn: () => fetchOrgs(),
  });
  const { data: cpData, isLoading: cpLoading } = useQuery({
    queryKey: ["my-counterparties"],
    queryFn: () => fetchCounterparties(),
  });

  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [cpDialogOpen, setCpDialogOpen] = useState(false);
  const [cpDetailsLinkId, setCpDetailsLinkId] = useState<string | null>(null);

  const removeMutation = useMutation({
    mutationFn: (linkId: string) => removeFn({ data: { linkId } }),
    onSuccess: () => {
      toast.success(t("organizations.counterparties.removed"));
      queryClient.invalidateQueries({ queryKey: ["my-counterparties"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  const deleteOrgMutation = useMutation({
    mutationFn: (organizationId: string) =>
      deleteOrgFn({ data: { organizationId } }),
    onSuccess: () => {
      toast.success(t("organizations.deleted"));
      queryClient.invalidateQueries({ queryKey: ["my-organizations"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  const isAdmin = data?.isAdmin ?? false;

  const counterparties = cpData?.counterparties ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-12">
        {/* === MOJE ORGANIZACJE === */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-semibold text-foreground">
              {t("organizations.title")}
            </h1>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("organizations.title_help_aria")}
                    className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                  >
                    <HelpCircle className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs leading-relaxed">
                  {t("organizations.title_help")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Button onClick={() => setOrgDialogOpen(true)}>
            {t("organizations.new")}
          </Button>
        </div>

        {isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (data?.organizations ?? []).length === 0 ? (
          <p className="mt-8 rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {t("organizations.empty")}
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {data!.organizations.map((org) => (
              <li
                key={org.id}
                className="flex items-stretch rounded-md border border-border bg-card transition-colors hover:bg-accent"
              >
                <Link
                  to="/organizations/$orgId"
                  params={{ orgId: org.id }}
                  className="flex flex-1 items-center justify-between p-4"
                >
                  <div>
                    <p className="font-medium text-foreground">{org.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <OrgTypesText types={org.types as string[] | null} />
                    </p>
                  </div>
                  <Badge
                    variant={
                      org.status === "approved"
                        ? "default"
                        : org.status === "pending"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {t(`organizations.status.${org.status}`)}
                  </Badge>
                </Link>
                {isAdmin && (
                  <div className="flex items-center pr-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (
                          window.confirm(
                            t("organizations.delete_confirm", { name: org.name }),
                          )
                        ) {
                          deleteOrgMutation.mutate(org.id);
                        }
                      }}
                      disabled={deleteOrgMutation.isPending}
                      aria-label={t("organizations.delete")}
                      title={t("organizations.delete")}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* === GRUBY SEPARATOR === */}
        <div className="my-12">
          <Separator className="h-[3px] bg-border" />
        </div>

        {/* === KONTRAHENCI === */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold text-foreground">
              {t("organizations.counterparties.section_title")}
            </h2>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("organizations.counterparties.section_title")}
                    className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                  >
                    <HelpCircle className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs leading-relaxed">
                  {t("organizations.counterparties.section_help")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Button onClick={() => setCpDialogOpen(true)}>
            {t("organizations.counterparties.add_btn")}
          </Button>
        </div>

        {cpLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : counterparties.length === 0 ? (
          <p className="mt-6 rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {t("organizations.counterparties.empty")}
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-md border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">
                    {t("organizations.counterparties.table.name")}
                  </TableHead>
                  <TableHead className="min-w-[160px]">
                    {t("organizations.counterparties.table.types")}
                  </TableHead>
                  <TableHead className="min-w-[120px]">
                    {t("organizations.counterparties.table.tax_id")}
                  </TableHead>
                  <TableHead className="min-w-[240px]">
                    {t("organizations.counterparties.table.address")}
                  </TableHead>
                  <TableHead className="min-w-[110px]">
                    {t("organizations.counterparties.table.source")}
                  </TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {counterparties.map((cp) => {
                  if (!cp.organization) return null;
                  const o = cp.organization;
                  const addr = [
                    [o.address_postal_code, o.address_city]
                      .filter(Boolean)
                      .join(" "),
                    [o.address_street, o.address_building_no]
                      .filter(Boolean)
                      .join(" "),
                    o.address_country,
                  ]
                    .filter((s) => s && s.length > 0)
                    .join(" · ");
                  return (
                    <TableRow
                      key={cp.link_id}
                      className="cursor-pointer"
                      onClick={() => setCpDetailsLinkId(cp.link_id)}
                    >
                      <TableCell className="font-medium text-foreground">
                        {o.name}
                        {o.legal_name && o.legal_name !== o.name && (
                          <div className="text-xs text-muted-foreground">
                            {o.legal_name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <OrgTypesText types={o.types as string[] | null} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {o.tax_id ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {addr || "—"}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              window.confirm(
                                t("organizations.counterparties.remove_confirm"),
                              )
                            ) {
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
      </main>

      <RegisterOrgDialog
        open={orgDialogOpen}
        onOpenChange={setOrgDialogOpen}
        defaultCountry="PL"
      />
      <AddCounterpartyDialog
        open={cpDialogOpen}
        onOpenChange={setCpDialogOpen}
      />
      <CounterpartyDetailsDialog
        linkId={cpDetailsLinkId}
        onOpenChange={(open) => !open && setCpDetailsLinkId(null)}
      />

    </div>
  );
}
