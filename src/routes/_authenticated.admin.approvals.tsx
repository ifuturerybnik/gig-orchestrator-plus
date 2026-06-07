import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrgTypesText } from "@/components/organizations/OrgTypesText";
import {
  decideOrgChangeRequest,
  listPendingOrganizations,
  listPendingOrgChangeRequests,
  setOrganizationStatus,
} from "@/lib/organizations.functions";
import {
  listJoinRequests,
  decideJoinRequest,
} from "@/lib/counterparties.functions";


export const Route = createFileRoute("/_authenticated/admin/approvals")({
  component: AdminApprovalsPage,
});

function AdminApprovalsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fetchPending = useServerFn(listPendingOrganizations);
  const setStatus = useServerFn(setOrganizationStatus);
  const fetchJoins = useServerFn(listJoinRequests);
  const decideJoin = useServerFn(decideJoinRequest);
  const [tab, setTab] = useState<"orgs" | "joins">("orgs");

  const pendingQuery = useQuery({
    queryKey: ["pending-organizations"],
    queryFn: () => fetchPending(),
  });

  const joinsQuery = useQuery({
    queryKey: ["pending-join-requests"],
    queryFn: () => fetchJoins(),
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

  const joinMutation = useMutation({
    mutationFn: (input: { requestId: string; decision: "approved" | "rejected" }) =>
      decideJoin({ data: input }),
    onSuccess: (_d, vars) => {
      toast.success(
        vars.decision === "approved"
          ? t("admin.approvals.join_approved")
          : t("admin.approvals.join_rejected"),
      );
      queryClient.invalidateQueries({ queryKey: ["pending-join-requests"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const orgs = pendingQuery.data?.organizations ?? [];
  const joins = joinsQuery.data?.requests ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">
        {t("admin.approvals.title")}
      </h1>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "orgs" | "joins")} className="mt-6">
        <TabsList>
          <TabsTrigger value="orgs">
            {t("admin.approvals.tab_orgs")} ({orgs.length})
          </TabsTrigger>
          <TabsTrigger value="joins">
            {t("admin.approvals.tab_joins")} ({joins.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orgs" className="mt-4">
          {pendingQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : orgs.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {t("admin.approvals.empty")}
            </p>
          ) : (
            <ul className="space-y-3">
              {orgs.map((org) => (
                <li key={org.id} className="rounded-md border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">{org.name}</p>
                      <p className="text-xs text-muted-foreground">
                        <OrgTypesText types={org.types as string[] | null} />
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
        </TabsContent>

        <TabsContent value="joins" className="mt-4">
          {joinsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : joins.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {t("admin.approvals.joins_empty")}
            </p>
          ) : (
            <ul className="space-y-3">
              {joins.map((r) => {
                const org = (r as { organizations?: { name?: string; tax_id?: string | null; types?: string[] | null } | null }).organizations;
                return (
                  <li key={r.id} className="rounded-md border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {org?.name ?? r.organization_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <OrgTypesText types={org?.types ?? null} />
                          {org?.tax_id ? ` · NIP ${org.tax_id}` : ""}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          User: <span className="font-mono">{r.user_id}</span>
                        </p>
                        {r.message && (
                          <p className="mt-2 text-sm text-foreground">
                            <span className="text-xs text-muted-foreground">
                              {t("admin.approvals.join_message")}
                            </span>{" "}
                            {r.message}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            joinMutation.mutate({ requestId: r.id, decision: "approved" })
                          }
                          disabled={joinMutation.isPending}
                        >
                          {t("common.approve")}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            joinMutation.mutate({ requestId: r.id, decision: "rejected" })
                          }
                          disabled={joinMutation.isPending}
                        >
                          {t("common.reject")}
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
