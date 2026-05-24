import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { getMyProfile } from "@/lib/profile.functions";
import {
  listPendingOrganizations,
  setOrganizationStatus,
} from "@/lib/organizations.functions";

export const Route = createFileRoute("/_authenticated/admin/approvals")({
  component: AdminApprovalsPage,
});

function AdminApprovalsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchPending = useServerFn(listPendingOrganizations);
  const setStatus = useServerFn(setOrganizationStatus);

  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });

  const pendingQuery = useQuery({
    queryKey: ["pending-organizations"],
    queryFn: () => fetchPending(),
    enabled: profileQuery.data?.isAdmin === true,
  });

  const mutation = useMutation({
    mutationFn: (input: { organizationId: string; status: "approved" | "rejected" }) =>
      setStatus({ data: input }),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.status === "approved"
          ? t("organizations.messages.approved")
          : t("organizations.messages.rejected"),
      );
      queryClient.invalidateQueries({ queryKey: ["pending-organizations"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (profileQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-12">
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </main>
      </div>
    );
  }

  if (!profileQuery.data?.isAdmin) {
    return <Navigate to="/dashboard" />;
  }

  const items = pendingQuery.data?.organizations ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-semibold text-foreground">{t("admin.approvals.title")}</h1>

        {pendingQuery.isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : items.length === 0 ? (
          <p className="mt-8 rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {t("admin.approvals.empty")}
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {items.map((org) => (
              <li key={org.id} className="rounded-md border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">{org.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t(`organizations.type.${org.type}`)}
                    </p>
                    {org.description && (
                      <p className="mt-2 text-sm text-foreground">{org.description}</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("admin.approvals.created_at")}{" "}
                      {new Date(org.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        mutation.mutate({ organizationId: org.id, status: "approved" })
                      }
                      disabled={mutation.isPending}
                    >
                      {t("common.approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        mutation.mutate({ organizationId: org.id, status: "rejected" })
                      }
                      disabled={mutation.isPending}
                    >
                      {t("common.reject")}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
