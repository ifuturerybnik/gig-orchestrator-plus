import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, Plus, Bot, AlertCircle, Loader2, Send, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getMyProfile } from "@/lib/profile.functions";
import {
  getAiKonfiguracja,
  updateAiKonfiguracja,
  getAiUzycieStats,
  callAi,
  pingAi,
} from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/admin/ai")({
  component: AiIntegrationPage,
});

const SCENARIUSZE_DEFAULT = [
  "streszczenie_maila",
  "generator_maila",
  "kategoryzacja_kontaktu",
  "podsumowanie_eventu",
  "asystent",
  "analiza_dokumentu",
  "inne",
];

function AiIntegrationPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchKonf = useServerFn(getAiKonfiguracja);
  const updateKonf = useServerFn(updateAiKonfiguracja);
  const fetchStats = useServerFn(getAiUzycieStats);
  const fetchCallAi = useServerFn(callAi);
  const fetchPing = useServerFn(pingAi);

  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });
  const isAdmin = profileQuery.data?.isAdmin === true;

  const konfQuery = useQuery({
    queryKey: ["ai-konfiguracja"],
    queryFn: () => fetchKonf(),
    enabled: isAdmin,
  });
  const statsQuery = useQuery({
    queryKey: ["ai-uzycie-stats"],
    queryFn: () => fetchStats(),
    enabled: isAdmin,
    refetchInterval: 30_000,
  });

  const konf = konfQuery.data;

  const [enabled, setEnabled] = useState(true);
  const [defaultModel, setDefaultModel] = useState("gpt-4o-mini");
  const [models, setModels] = useState<string[]>([]);
  const [scenMap, setScenMap] = useState<Record<string, string>>({});
  const [limit, setLimit] = useState("50");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState("0.7");
  const [maxTokens, setMaxTokens] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newScen, setNewScen] = useState("");

  useEffect(() => {
    if (!konf) return;
    setEnabled(konf.enabled);
    setDefaultModel(konf.default_model);
    setModels(konf.models ?? []);
    setScenMap(konf.scenariusz_model ?? {});
    setLimit(String(konf.monthly_limit_usd ?? 50));
    setSystemPrompt(konf.system_prompt ?? "");
    setTemperature(String(konf.temperature ?? 0.7));
    setMaxTokens(konf.max_tokens ? String(konf.max_tokens) : "");
  }, [konf]);

  const saveMut = useMutation({
    mutationFn: () => {
      const n = Number(limit);
      const temp = Number(temperature);
      const maxT = maxTokens.trim() === "" ? null : Number(maxTokens);
      if (!Number.isFinite(n) || n < 0) throw new Error(t("admin.ai.errors.bad_limit"));
      if (!Number.isFinite(temp) || temp < 0 || temp > 2)
        throw new Error(t("admin.ai.errors.bad_temperature"));
      if (maxT !== null && (!Number.isFinite(maxT) || maxT < 1))
        throw new Error(t("admin.ai.errors.bad_max_tokens"));
      if (!models.includes(defaultModel)) throw new Error(t("admin.ai.errors.bad_default_model"));
      return updateKonf({
        data: {
          enabled,
          default_model: defaultModel,
          models,
          scenariusz_model: scenMap,
          monthly_limit_usd: n,
          system_prompt: systemPrompt.trim() || null,
          temperature: temp,
          max_tokens: maxT,
        },
      });
    },
    onSuccess: () => {
      toast.success(t("admin.ai.saved"));
      queryClient.invalidateQueries({ queryKey: ["ai-konfiguracja"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pingMut = useMutation({
    mutationFn: () => fetchPing(),
    onSuccess: (r: { models_count: number }) =>
      toast.success(t("admin.ai.ping_ok", { count: r.models_count })),
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- Playground ----
  const [playPrompt, setPlayPrompt] = useState("");
  const [playScen, setPlayScen] = useState("inne");
  const [playModel, setPlayModel] = useState<string>("");
  const [playResult, setPlayResult] = useState<{
    content: string;
    model: string;
    tokens_in: number;
    tokens_out: number;
    cost_usd: number;
  } | null>(null);

  const playMut = useMutation({
    mutationFn: () =>
      fetchCallAi({
        data: {
          messages: [{ role: "user", content: playPrompt }],
          scenariusz: playScen || "inne",
          ...(playModel ? { model: playModel } : {}),
        },
      }),
    onSuccess: (r) => {
      setPlayResult(r);
      queryClient.invalidateQueries({ queryKey: ["ai-uzycie-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addModel() {
    const m = newModel.trim();
    if (!m) return;
    if (models.includes(m)) {
      toast.error(t("admin.ai.errors.model_exists"));
      return;
    }
    setModels([...models, m]);
    setNewModel("");
  }
  function removeModel(m: string) {
    const next = models.filter((x) => x !== m);
    setModels(next);
    if (defaultModel === m) setDefaultModel(next[0] ?? "");
    const sm = { ...scenMap };
    for (const k of Object.keys(sm)) if (sm[k] === m) delete sm[k];
    setScenMap(sm);
  }
  function setScen(scen: string, model: string) {
    const next = { ...scenMap };
    if (!model || model === "__default__") delete next[scen];
    else next[scen] = model;
    setScenMap(next);
  }
  function addScen() {
    const s = newScen.trim().toLowerCase().replace(/\s+/g, "_");
    if (!s) return;
    if (scenMap[s] !== undefined || SCENARIUSZE_DEFAULT.includes(s)) {
      toast.error(t("admin.ai.errors.scen_exists"));
      return;
    }
    setScenMap({ ...scenMap, [s]: defaultModel });
    setNewScen("");
  }

  if (profileQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!isAdmin) return <Navigate to="/dashboard" />;
  if (konfQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
      </div>
    );
  }

  const stats = statsQuery.data;
  const limitNum = Number(limit) || 0;
  const usagePct = stats && limitNum > 0 ? Math.min(100, (stats.totalCost / limitNum) * 100) : 0;
  const allScenariusze = Array.from(
    new Set([...SCENARIUSZE_DEFAULT, ...Object.keys(scenMap)]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("admin.ai.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.ai.subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Bot className="h-6 w-6 text-primary" />
            <div>
              <CardTitle className="text-lg">{t("admin.ai.card_provider")}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("admin.ai.provider_help")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pingMut.mutate()}
              disabled={pingMut.isPending}
            >
              <Zap className="mr-1 h-4 w-4" />
              {pingMut.isPending ? t("admin.ai.testing") : t("admin.ai.test_connection")}
            </Button>
            <Label htmlFor="ai-enabled" className="text-sm">
              {enabled ? t("admin.ai.enabled") : t("admin.ai.disabled")}
            </Label>
            <Switch id="ai-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.ai.usage_month")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">
              ${(stats?.totalCost ?? 0).toFixed(4)}
            </span>
            <span className="text-muted-foreground">
              {t("admin.ai.of_limit", { limit: limitNum.toFixed(2) })}
            </span>
            <span className="ml-auto text-sm text-muted-foreground">
              {t("admin.ai.calls_errors", {
                calls: stats?.totalCalls ?? 0,
                errors: stats?.totalErrors ?? 0,
              })}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all ${
                usagePct >= 90
                  ? "bg-destructive"
                  : usagePct >= 70
                    ? "bg-yellow-500"
                    : "bg-primary"
              }`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          {usagePct >= 90 && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {t("admin.ai.near_limit")}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.ai.config")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label>{t("admin.ai.monthly_limit")}</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">{t("admin.ai.monthly_limit_help")}</p>
            </div>
            <div>
              <Label>{t("admin.ai.default_model")}</Label>
              <Select value={defaultModel} onValueChange={setDefaultModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("admin.ai.default_model_help")}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t("admin.ai.temperature")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={2}
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                />
              </div>
              <div>
                <Label>{t("admin.ai.max_tokens")}</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="auto"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <Label>{t("admin.ai.system_prompt")}</Label>
            <Textarea
              rows={3}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder={t("admin.ai.system_prompt_placeholder")}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("admin.ai.system_prompt_help")}</p>
          </div>

          <div>
            <Label>{t("admin.ai.available_models")}</Label>
            <div className="mb-2 mt-2 flex flex-wrap gap-2">
              {models.map((m) => (
                <Badge key={m} variant="secondary" className="gap-1 pr-1">
                  {m}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 hover:bg-destructive/20"
                    onClick={() => removeModel(m)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
              {models.length === 0 && (
                <span className="text-sm text-muted-foreground">{t("admin.ai.no_models")}</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder={t("admin.ai.new_model_placeholder")}
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addModel();
                  }
                }}
                className="max-w-xs"
              />
              <Button variant="outline" size="sm" onClick={addModel}>
                <Plus className="mr-1 h-4 w-4" />
                {t("admin.ai.add_model")}
              </Button>
            </div>
          </div>

          <div>
            <Label>{t("admin.ai.scen_model")}</Label>
            <p className="mb-2 text-xs text-muted-foreground">{t("admin.ai.scen_model_help")}</p>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.ai.scenario")}</TableHead>
                    <TableHead>{t("admin.ai.model")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allScenariusze.map((s) => (
                    <TableRow key={s}>
                      <TableCell className="font-mono text-sm">{s}</TableCell>
                      <TableCell>
                        <Select
                          value={scenMap[s] || "__default__"}
                          onValueChange={(v) => setScen(s, v)}
                        >
                          <SelectTrigger className="w-64">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__default__">
                              {t("admin.ai.use_default", { model: defaultModel })}
                            </SelectItem>
                            {models.map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                placeholder={t("admin.ai.new_scen_placeholder")}
                value={newScen}
                onChange={(e) => setNewScen(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addScen();
                  }
                }}
                className="max-w-xs"
              />
              <Button variant="outline" size="sm" onClick={addScen}>
                <Plus className="mr-1 h-4 w-4" />
                {t("admin.ai.add_scen")}
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? t("admin.ai.saving") : t("admin.ai.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.ai.playground")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>{t("admin.ai.scenario")}</Label>
              <Input
                value={playScen}
                onChange={(e) => setPlayScen(e.target.value)}
                placeholder="inne"
              />
            </div>
            <div>
              <Label>{t("admin.ai.model_override")}</Label>
              <Select value={playModel || "__default__"} onValueChange={(v) => setPlayModel(v === "__default__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">{t("admin.ai.use_config")}</SelectItem>
                  {models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>{t("admin.ai.prompt")}</Label>
            <Textarea
              rows={4}
              value={playPrompt}
              onChange={(e) => setPlayPrompt(e.target.value)}
              placeholder={t("admin.ai.prompt_placeholder")}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => playMut.mutate()} disabled={playMut.isPending || !playPrompt.trim()}>
              <Send className="mr-1 h-4 w-4" />
              {playMut.isPending ? t("admin.ai.sending") : t("admin.ai.send")}
            </Button>
          </div>
          {playResult && (
            <div className="rounded-md border bg-muted/30 p-3">
              <pre className="whitespace-pre-wrap text-sm">{playResult.content}</pre>
              <p className="mt-2 text-xs text-muted-foreground">
                {playResult.model} · in {playResult.tokens_in} / out {playResult.tokens_out} · $
                {playResult.cost_usd.toFixed(5)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {(["byUser", "byScen", "byModel"] as const).map((key) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="text-sm">{t(`admin.ai.${key}`)}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t(`admin.ai.${key}_label`)}</TableHead>
                    <TableHead className="text-right">{t("admin.ai.calls")}</TableHead>
                    <TableHead className="text-right">{t("admin.ai.cost")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(stats?.[key] ?? []).map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="text-xs">{r.key}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.calls}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        ${r.cost.toFixed(4)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!stats || stats[key].length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-4 text-center text-sm text-muted-foreground">
                        {t("admin.ai.no_data")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.ai.recent")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>{t("admin.ai.time")}</TableHead>
                  <TableHead>{t("admin.ai.user")}</TableHead>
                  <TableHead>{t("admin.ai.scenario")}</TableHead>
                  <TableHead>{t("admin.ai.model")}</TableHead>
                  <TableHead className="text-right">in/out</TableHead>
                  <TableHead className="text-right">{t("admin.ai.cost")}</TableHead>
                  <TableHead>{t("admin.ai.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(stats?.rows ?? []).slice(0, 100).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs">{r.user_email ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.scenariusz}</TableCell>
                    <TableCell className="text-xs">{r.model}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {r.tokens_in}/{r.tokens_out}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      ${Number(r.cost_usd).toFixed(5)}
                    </TableCell>
                    <TableCell>
                      {r.status === "ok" ? (
                        <Badge variant="secondary" className="text-xs">
                          ok
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs" title={r.error ?? ""}>
                          {r.status}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(!stats || stats.rows.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                      {t("admin.ai.no_calls")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
