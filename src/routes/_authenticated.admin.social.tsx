import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Share2, Save, RefreshCw, AlertCircle, CheckCircle2, MinusCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getMyProfile } from "@/lib/profile.functions";
import {
  getSocialAdminSettings,
  updateSocialAdminSettings,
  listSocialSyncRuns,
  type SyncRunRow,
} from "@/lib/admin-social.functions";
import { SOCIAL_SETTINGS_BOUNDS, type SocialSettings } from "@/lib/social-settings.server";

export const Route = createFileRoute("/_authenticated/admin/social")({
  component: AdminSocialPage,
});

function AdminSocialPage() {
  const { t } = useTranslation();
  const fetchProfile = useServerFn(getMyProfile);
  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });

  if (profileQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!profileQuery.data?.isAdmin) return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Share2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("admin.social.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("admin.social.subtitle")}</p>
        </div>
      </header>

      <Tabs defaultValue="limits" className="w-full">
        <TabsList>
          <TabsTrigger value="limits">{t("admin.social.tabs.limits")}</TabsTrigger>
          <TabsTrigger value="runs">{t("admin.social.tabs.runs")}</TabsTrigger>
        </TabsList>
        <TabsContent value="limits" className="mt-6">
          <LimitsTab />
        </TabsContent>
        <TabsContent value="runs" className="mt-6">
          <RunsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ----- LIMITS TAB -----

const FIELDS: Array<{ key: keyof SocialSettings; section: "sync" | "import" | "ai" }> = [
  { key: "syncInboxMaxPosts", section: "sync" },
  { key: "syncInboxWindowDays", section: "sync" },
  { key: "syncMetricsMaxPosts", section: "sync" },
  { key: "syncMetricsWindowDays", section: "sync" },
  { key: "importPerAccountLimit", section: "import" },
  { key: "importMaxAccounts", section: "import" },
  { key: "aiModerationMaxPerTick", section: "ai" },
  { key: "aiModerationDailyBudgetCalls", section: "ai" },
];

function LimitsTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fetchFn = useServerFn(getSocialAdminSettings);
  const saveFn = useServerFn(updateSocialAdminSettings);

  const query = useQuery({
    queryKey: ["admin-social-settings"],
    queryFn: () => fetchFn(),
  });

  const [form, setForm] = useState<SocialSettings | null>(null);

  useEffect(() => {
    if (query.data && !form) setForm(query.data);
  }, [query.data, form]);

  const saveM = useMutation({
    mutationFn: () => saveFn({ data: form! }),
    onSuccess: () => {
      toast.success(t("admin.social.limits.saved"));
      qc.invalidateQueries({ queryKey: ["admin-social-settings"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  if (!form) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  const renderField = (key: keyof SocialSettings) => {
    const bounds = SOCIAL_SETTINGS_BOUNDS[key];
    return (
      <div key={key} className="space-y-1.5">
        <Label htmlFor={key}>{t(`admin.social.limits.fields.${key}.label`)}</Label>
        <Input
          id={key}
          type="number"
          min={bounds.min}
          max={bounds.max}
          value={form[key]}
          onChange={(e) =>
            setForm({ ...form, [key]: Math.floor(Number(e.target.value) || 0) })
          }
        />
        <p className="text-xs text-muted-foreground">
          {t(`admin.social.limits.fields.${key}.desc`)}{" "}
          <span className="opacity-70">
            ({t("admin.social.limits.range", { min: bounds.min, max: bounds.max })})
          </span>
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.social.limits.sync_title")}</CardTitle>
          <CardDescription>{t("admin.social.limits.sync_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {FIELDS.filter((f) => f.section === "sync").map((f) => renderField(f.key))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.social.limits.import_title")}</CardTitle>
          <CardDescription>{t("admin.social.limits.import_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {FIELDS.filter((f) => f.section === "import").map((f) => renderField(f.key))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.social.limits.ai_title")}</CardTitle>
          <CardDescription>{t("admin.social.limits.ai_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {FIELDS.filter((f) => f.section === "ai").map((f) => renderField(f.key))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}

// ----- RUNS TAB -----

function RunsTab() {
  const { t } = useTranslation();
  const fetchFn = useServerFn(listSocialSyncRuns);
  const [job, setJob] = useState<"all" | "sync-inbox" | "sync-metrics" | "import-posts">(
    "all",
  );

  const query = useQuery({
    queryKey: ["admin-social-runs", job],
    queryFn: () =>
      fetchFn({ data: { job: job === "all" ? undefined : job, limit: 100 } }),
    refetchInterval: 30_000,
  });

  const rows: SyncRunRow[] = query.data?.rows ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>{t("admin.social.runs.title")}</CardTitle>
          <CardDescription>{t("admin.social.runs.desc")}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={job} onValueChange={(v) => setJob(v as typeof job)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.social.runs.filter_all")}</SelectItem>
              <SelectItem value="sync-inbox">sync-inbox</SelectItem>
              <SelectItem value="sync-metrics">sync-metrics</SelectItem>
              <SelectItem value="import-posts">import-posts</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.social.runs.col_when")}</TableHead>
              <TableHead>{t("admin.social.runs.col_job")}</TableHead>
              <TableHead className="text-right">{t("admin.social.runs.col_duration")}</TableHead>
              <TableHead className="text-right">{t("admin.social.runs.col_processed")}</TableHead>
              <TableHead className="text-right">{t("admin.social.runs.col_ok")}</TableHead>
              <TableHead className="text-right">{t("admin.social.runs.col_fail")}</TableHead>
              <TableHead className="text-right">{t("admin.social.runs.col_skipped")}</TableHead>
              <TableHead className="text-right">{t("admin.social.runs.col_inserted")}</TableHead>
              <TableHead className="text-right">{t("admin.social.runs.col_ai")}</TableHead>
              <TableHead>{t("admin.social.runs.col_errors")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">
                  {t("admin.social.runs.empty")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(r.started_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {r.job}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {r.duration_ms != null ? `${r.duration_ms} ms` : "—"}
                  </TableCell>
                  <TableCell className="text-right">{r.processed}</TableCell>
                  <TableCell className="text-right">
                    {r.ok_count > 0 ? (
                      <span className="text-emerald-600 inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {r.ok_count}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.fail_count > 0 ? (
                      <span className="text-destructive inline-flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {r.fail_count}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {(r.skipped_disabled || r.skipped_permission || r.skipped_budget) > 0 ? (
                      <span className="text-amber-600 inline-flex items-center gap-1">
                        <MinusCircle className="h-3 w-3" />
                        {r.skipped_disabled + r.skipped_permission + r.skipped_budget}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">{r.inserted}</TableCell>
                  <TableCell className="text-right">
                    {r.ai_moderated > 0 ? r.ai_moderated : "—"}
                  </TableCell>
                  <TableCell className="text-xs max-w-[280px]">
                    {r.error_summary && r.error_summary.length > 0 ? (
                      <details>
                        <summary className="cursor-pointer text-destructive">
                          {r.error_summary.length}
                        </summary>
                        <ul className="mt-1 space-y-1">
                          {r.error_summary.map((e, i) => (
                            <li key={i} className="break-words">
                              <span className="font-mono opacity-70">{e.ref}</span>:{" "}
                              {e.message}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
