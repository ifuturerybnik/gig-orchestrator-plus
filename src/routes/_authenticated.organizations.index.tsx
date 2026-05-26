import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { HelpCircle } from "lucide-react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link } from "@tanstack/react-router";
import { listMyOrganizations } from "@/lib/organizations.functions";
import { RegisterOrgDialog } from "@/components/organizations/RegisterOrgDialog";
import { OrgTypesText } from "@/components/organizations/OrgTypesText";

export const Route = createFileRoute("/_authenticated/organizations/")({
  component: OrganizationsListPage,
});

function OrganizationsListPage() {
  const { t } = useTranslation();
  const fetchOrgs = useServerFn(listMyOrganizations);
  const { data, isLoading } = useQuery({
    queryKey: ["my-organizations"],
    queryFn: () => fetchOrgs(),
  });
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-12">
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
          <Button onClick={() => setDialogOpen(true)}>
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
              <li key={org.id}>
                <Link
                  to="/organizations/$orgId"
                  params={{ orgId: org.id }}
                  className="flex items-center justify-between rounded-md border border-border bg-card p-4 transition-colors hover:bg-accent"
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
              </li>
            ))}
          </ul>
        )}
      </main>

      <RegisterOrgDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultCountry="PL"
      />
    </div>
  );
}
