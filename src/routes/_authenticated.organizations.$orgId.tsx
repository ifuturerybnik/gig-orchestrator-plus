import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { Header } from "@/components/header";
import { OrgSidebar } from "@/components/org-sidebar";
import { Badge } from "@/components/ui/badge";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getOrganizationDetails } from "@/lib/organizations.functions";

export const Route = createFileRoute("/_authenticated/organizations/$orgId")({
  component: OrganizationLayout,
});

function OrganizationLayout() {
  const { orgId } = Route.useParams();
  const { t, i18n } = useTranslation();

  const fetchDetails = useServerFn(getOrganizationDetails);
  const detailsQuery = useQuery({
    queryKey: ["organization", orgId],
    queryFn: () => fetchDetails({ data: { organizationId: orgId } }),
  });

  const org = detailsQuery.data?.organization as
    | { name?: string; status?: string; deletion_scheduled_for?: string | null }
    | undefined;
  const orgName = org?.name ?? t("common.loading");
  const deletionScheduledFor = org?.deletion_scheduled_for ?? null;
  const dateFmt = new Intl.DateTimeFormat(i18n.language || "pl", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <SidebarProvider className="flex-1 min-h-0">
        <OrgSidebar orgId={orgId} orgName={orgName} />
        <SidebarInset>
          <div className="flex h-12 items-center gap-2 border-b border-border bg-background px-4">
            <SidebarTrigger />
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">
                {orgName}
              </span>
              {org && org.status && (
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
              )}
            </div>
          </div>
          {deletionScheduledFor && (
            <div className="flex items-start gap-3 border-b border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">
                  {t("organizations.deletion.banner_title")}
                </p>
                <p className="text-xs">
                  {t("organizations.deletion.banner_body", {
                    date: dateFmt.format(new Date(deletionScheduledFor)),
                  })}
                </p>
              </div>
            </div>
          )}
          <main className="w-full px-4 py-6">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
