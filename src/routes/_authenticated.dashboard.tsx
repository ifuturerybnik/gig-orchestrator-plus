import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { getMyProfile } from "@/lib/profile.functions";
import { PendingInvitations } from "@/components/PendingInvitations";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation();
  const fetchProfile = useServerFn(getMyProfile);
  const { data, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-semibold text-foreground">{t("nav.dashboard")}</h1>
        {isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <div className="mt-6 space-y-2 text-sm">
            <p className="text-muted-foreground">{data?.email}</p>
            {data?.profile?.first_name && (
              <p className="text-foreground">
                {data.profile.first_name} {data.profile.last_name}
              </p>
            )}
          </div>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/organizations">
            <Button>{t("nav.organizations")}</Button>
          </Link>
          {data?.isAdmin && (
            <Link to="/admin/approvals">
              <Button variant="outline">{t("nav.approvals")}</Button>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
