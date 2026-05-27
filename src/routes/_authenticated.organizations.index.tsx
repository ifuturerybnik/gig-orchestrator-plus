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
      <main className="mx-auto max-w-4xl px-4 py-12">
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
          <ul className="mt-6 space-y-3">
            {counterparties.map((cp) =>
              cp.organization ? (
                <li
                  key={cp.link_id}
                  className="flex items-center justify-between rounded-md border border-border bg-card transition-colors hover:bg-accent"
                >
                  <button
                    type="button"
                    onClick={() => setCpDetailsLinkId(cp.link_id)}
                    className="flex min-w-0 flex-1 items-center p-4 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">
                        {cp.organization.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        <OrgTypesText
                          types={cp.organization.types as string[] | null}
                        />
                        {cp.organization.tax_id ? ` · NIP: ${cp.organization.tax_id}` : ""}
                        {cp.organization.address_city
                          ? ` · ${cp.organization.address_city}`
                          : ""}
                      </p>
                    </div>
                  </button>
                  <div className="pr-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(t("organizations.counterparties.remove_confirm"))) {
                          removeMutation.mutate(cp.link_id);
                        }
                      }}
                      disabled={removeMutation.isPending}
                      aria-label={t("organizations.counterparties.remove")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ) : null,
            )}
          </ul>
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
    </div>
  );
}
