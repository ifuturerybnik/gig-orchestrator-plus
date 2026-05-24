import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listMyOrganizations } from "@/lib/organizations.functions";

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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-foreground">{t("organizations.title")}</h1>
          <Link to="/organizations/new">
            <Button>{t("organizations.new")}</Button>
          </Link>
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
                      {t(`organizations.type.${org.type}`)}
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
    </div>
  );
}
