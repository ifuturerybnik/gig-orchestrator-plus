import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RefreshCw, AlertTriangle, Database } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getMyProfile } from "@/lib/profile.functions";
import {
  getAssistantKbStatus,
  reindexAssistantKb,
} from "@/lib/assistant.functions";

export const Route = createFileRoute("/_authenticated/admin/assistant")({
  component: AdminAssistantPage,
});

function AdminAssistantPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchStatus = useServerFn(getAssistantKbStatus);
  const reindex = useServerFn(reindexAssistantKb);

  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });
  const isSuperAdmin = profileQuery.data?.isSuperAdmin === true;

  const statusQuery = useQuery({
    queryKey: ["assistant-kb-status"],
    queryFn: () => fetchStatus(),
    enabled: isSuperAdmin,
  });

  const reindexMutation = useMutation({
    mutationFn: () => reindex(),
    onSuccess: (data) => {
      toast.success(
        t("admin.assistant.reindex_done", {
          chunks: data.chunks,
          cost: data.costUsd.toFixed(4),
        }),
      );
      qc.invalidateQueries({ queryKey: ["assistant-kb-status"] });
    },
    onError: (err: Error) =>
      toast.error(t("admin.assistant.reindex_error", { msg: err.message })),
  });

  if (profileQuery.isLoading) return null;
  if (!isSuperAdmin) return <Navigate to="/dashboard" />;

  const s = statusQuery.data;
  const isStale = (s?.daysSinceLastRun ?? 0) >= 60;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("admin.assistant.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("admin.assistant.subtitle")}
        </p>
      </header>

      {isStale && s && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
          <p>
            {t("admin.assistant.status.stale_warning", {
              days: s.daysSinceLastRun,
            })}
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {t("admin.assistant.title")}
          </CardTitle>
          <CardDescription>{t("admin.assistant.hint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              …
            </p>
          ) : s ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatBox label={t("admin.assistant.status.total")} value={s.totalChunks} />
              <StatBox label={t("admin.assistant.status.docs")} value={s.docChunks} />
              <StatBox label={t("admin.assistant.status.code")} value={s.codeChunks} />
              <StatBox
                label={t("admin.assistant.status.last_run")}
                value={
                  s.lastRunAt
                    ? new Date(s.lastRunAt).toLocaleString()
                    : t("admin.assistant.status.last_run_never")
                }
                small
                badge={s.lastRunStatus ?? undefined}
              />
            </div>
          ) : null}

          <Button
            onClick={() => reindexMutation.mutate()}
            disabled={reindexMutation.isPending}
          >
            {reindexMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("admin.assistant.reindex_running")}
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("admin.assistant.reindex")}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function StatBox({
  label,
  value,
  small,
  badge,
}: {
  label: string;
  value: number | string;
  small?: boolean;
  badge?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={small ? "mt-1 text-sm font-medium" : "mt-1 text-2xl font-semibold"}>
        {value}
      </p>
      {badge && (
        <Badge variant={badge === "ok" ? "default" : "destructive"} className="mt-1">
          {badge}
        </Badge>
      )}
    </div>
  );
}
