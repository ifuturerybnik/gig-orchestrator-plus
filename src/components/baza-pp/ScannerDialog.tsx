import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ExternalLink, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  scanBaeMatches,
  scanRspoMatches,
  scanGusMatches,
  applyScannerUpdates,
  listScanTargetIds,
} from "@/lib/scanners.functions";

export type ScannerSource = "bae" | "rspo" | "gus";
export type ScannerScope = "selected" | "missing_target";

interface ScanItem {
  entityId: string;
  entity: {
    name: string | null;
    miejscowosc: string | null;
    wojewodztwo?: string | null;
    regon?: string | null;
    edoreczenia_ade?: string | null;
  };
  confidence: "exact_regon" | "exact_name_city" | "fuzzy" | "none";
  score?: number;
  match: null | Record<string, string | null | undefined>;
  patch: Record<string, string>;
}

interface ScanResult {
  source: ScannerSource;
  total: number;
  items: ScanItem[];
}

interface LogLine {
  ts: number;
  level: "info" | "ok" | "warn" | "err";
  text: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: ScannerSource;
  scope: ScannerScope;
  selectedIds: string[];
  onApplied?: () => void;
}

const BATCH_SIZE = 50;

export function ScannerDialog({
  open,
  onOpenChange,
  source,
  scope,
  selectedIds,
  onApplied,
}: Props) {
  const { t } = useTranslation();
  const baeFn = useServerFn(scanBaeMatches);
  const rspoFn = useServerFn(scanRspoMatches);
  const gusFn = useServerFn(scanGusMatches);
  const applyFn = useServerFn(applyScannerUpdates);
  const listIdsFn = useServerFn(listScanTargetIds);

  const [result, setResult] = useState<ScanResult | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);
  const [partialMode, setPartialMode] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(false);

  const pushLog = (level: LogLine["level"], text: string) => {
    setLogs((prev) => [...prev, { ts: Date.now(), level, text }]);
  };

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs.length]);

  const runScan = async () => {
    setRunning(true);
    cancelRef.current = false;
    setResult(null);
    setLogs([]);
    setAccepted(new Set());
    setProgress({ done: 0, total: 0 });

    try {
      pushLog("info", t("admin.bazaPp.scanner.live.start", { source: t(`admin.bazaPp.scanner.sources.${source}`) }));

      // Determine ids
      let ids: string[];
      if (scope === "selected") {
        ids = selectedIds;
        pushLog("info", t("admin.bazaPp.scanner.live.selected", { count: ids.length }));
      } else {
        pushLog("info", t("admin.bazaPp.scanner.live.listing"));
        const r = await listIdsFn({ data: { source } });
        ids = r.ids;
        pushLog("info", t("admin.bazaPp.scanner.live.foundMissing", { count: ids.length }));
      }

      if (ids.length === 0) {
        pushLog("warn", t("admin.bazaPp.scanner.live.empty"));
        setResult({ source, total: 0, items: [] });
        setRunning(false);
        return;
      }

      // GUS is not implemented yet — fail fast with server message.
      if (source === "gus") {
        pushLog("info", t("admin.bazaPp.scanner.live.fetching", { source: "GUS" }));
        await gusFn({ data: { scope: "selected", ids: ids.slice(0, 1) } });
        return;
      }

      setProgress({ done: 0, total: ids.length });
      pushLog("info", t("admin.bazaPp.scanner.live.fetching", { source: source.toUpperCase() }));

      const allItems: ScanItem[] = [];
      const auto = new Set<string>();

      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        if (cancelRef.current) {
          pushLog("warn", t("admin.bazaPp.scanner.live.cancelled"));
          break;
        }
        const batch = ids.slice(i, i + BATCH_SIZE);
        const res =
          source === "bae"
            ? ((await baeFn({
                data: {
                  scope: "selected",
                  ids: batch,
                  mode: partialMode ? "partial_type" : "standard",
                },
              })) as ScanResult)
            : ((await rspoFn({ data: { scope: "selected", ids: batch } })) as ScanResult);

        for (const it of res.items) {
          allItems.push(it);
          const hasPatch = Object.keys(it.patch).length > 0;
          const name = it.entity.name ?? "?";
          if (it.confidence === "exact_regon" || it.confidence === "exact_name_city") {
            if (hasPatch) auto.add(it.entityId);
            const fields = Object.keys(it.patch).join(", ") || "—";
            pushLog(
              "ok",
              `✓ ${name} → ${t("admin.bazaPp.scanner.live.matched")} (${fields})`,
            );
          } else if (it.confidence === "fuzzy") {
            pushLog(
              "warn",
              `? ${name} → ${t("admin.bazaPp.scanner.live.fuzzy")}${
                it.score ? ` (${Math.round(it.score * 100)}%)` : ""
              }`,
            );
          } else {
            pushLog("info", `· ${name} → ${t("admin.bazaPp.scanner.live.none")}`);
          }
        }
        setProgress({ done: Math.min(i + BATCH_SIZE, ids.length), total: ids.length });
        setResult({ source, total: allItems.length, items: [...allItems] });
        setAccepted(new Set(auto));
      }

      pushLog(
        "ok",
        t("admin.bazaPp.scanner.live.done", {
          total: allItems.length,
          auto: auto.size,
        }),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      pushLog("err", msg);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  const applyMut = useMutation({
    mutationFn: async () => {
      if (!result) return { updated: 0, errors: [], total: 0 };
      const updates = result.items
        .filter((it) => accepted.has(it.entityId) && Object.keys(it.patch).length > 0)
        .map((it) => ({ id: it.entityId, patch: it.patch }));
      if (updates.length === 0) return { updated: 0, errors: [], total: 0 };
      return await applyFn({ data: { source, updates } });
    },
    onSuccess: (res) => {
      toast.success(
        t("admin.bazaPp.scanner.applied", {
          updated: res.updated,
          errors: res.errors.length,
        }),
      );
      onApplied?.();
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : String(e));
    },
  });

  useEffect(() => {
    if (open) {
      void runScan();
    } else {
      cancelRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source, scope]);

  const stats = useMemo(() => {
    if (!result) return null;
    let exact = 0;
    let fuzzy = 0;
    let none = 0;
    for (const it of result.items) {
      if (it.confidence === "exact_regon" || it.confidence === "exact_name_city") exact++;
      else if (it.confidence === "fuzzy") fuzzy++;
      else none++;
    }
    return { exact, fuzzy, none };
  }, [result]);

  const toggleOne = (id: string) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!result) return;
    const withPatch = result.items.filter((i) => Object.keys(i.patch).length > 0);
    if (accepted.size === withPatch.length) {
      setAccepted(new Set());
    } else {
      setAccepted(new Set(withPatch.map((i) => i.entityId)));
    }
  };

  const confidenceBadge = (c: ScanItem["confidence"]) => {
    if (c === "exact_regon")
      return <Badge variant="default">{t("admin.bazaPp.scanner.conf.exactRegon")}</Badge>;
    if (c === "exact_name_city")
      return <Badge variant="default">{t("admin.bazaPp.scanner.conf.exactNameCity")}</Badge>;
    if (c === "fuzzy")
      return <Badge variant="secondary">{t("admin.bazaPp.scanner.conf.fuzzy")}</Badge>;
    return <Badge variant="outline">{t("admin.bazaPp.scanner.conf.none")}</Badge>;
  };

  const exportCsv = () => {
    if (!result) return;
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = [
      "entity_id",
      "name",
      "miejscowosc",
      "wojewodztwo",
      "current_regon",
      "current_ade",
      "confidence",
      "score",
      "match_name",
      "match_miejscowosc",
      "match_regon",
      "match_ade",
      "match_nip",
      "match_phone",
      "match_email",
      "match_www",
      "patch_fields",
      "patch_values",
    ];
    const rows = result.items.map((it) => [
      it.entityId,
      it.entity.name,
      it.entity.miejscowosc,
      it.entity.wojewodztwo,
      it.entity.regon,
      it.entity.edoreczenia_ade,
      it.confidence,
      it.score ?? "",
      it.match?.name ?? "",
      it.match?.miejscowosc ?? "",
      it.match?.regon ?? "",
      it.match?.ade ?? "",
      it.match?.nip ?? "",
      it.match?.phone ?? "",
      it.match?.email ?? "",
      it.match?.www ?? "",
      Object.keys(it.patch).join("|"),
      Object.values(it.patch).join("|"),
    ]);
    const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href = url;
    a.download = `scanner-${source}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sourceLabel = t(`admin.bazaPp.scanner.sources.${source}`);
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col gap-3 overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t("admin.bazaPp.scanner.title", { source: sourceLabel })}</DialogTitle>
          <DialogDescription>
            {scope === "selected"
              ? t("admin.bazaPp.scanner.scopeSelected", { count: selectedIds.length })
              : t("admin.bazaPp.scanner.scopeMissing")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">

        {source === "bae" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={partialMode}
                onCheckedChange={(v) => setPartialMode(v === true)}
                disabled={running}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">
                  {t("admin.bazaPp.scanner.partialMode.label")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("admin.bazaPp.scanner.partialMode.hint")}
                </span>
              </span>
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void runScan()}
              disabled={running}
            >
              {t("admin.bazaPp.scanner.rescan")}
            </Button>
          </div>
        )}

        {/* Progress + live log */}
        {(running || logs.length > 0) && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm">
              {running && <Loader2 className="h-4 w-4 animate-spin" />}
              <span className="text-muted-foreground">
                {progress.total > 0
                  ? t("admin.bazaPp.scanner.live.progress", {
                      done: progress.done,
                      total: progress.total,
                      pct,
                    })
                  : t("admin.bazaPp.scanner.scanning")}
              </span>
            </div>
            {progress.total > 0 && <Progress value={pct} />}
            <div
              ref={logRef}
              className="max-h-48 overflow-auto rounded-md border bg-muted/30 p-2 font-mono text-xs"
            >
              {logs.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.level === "ok"
                      ? "text-emerald-600"
                      : l.level === "warn"
                        ? "text-amber-600"
                        : l.level === "err"
                          ? "text-destructive"
                          : "text-muted-foreground"
                  }
                >
                  {l.text}
                </div>
              ))}
            </div>
          </div>
        )}

        {result && stats && result.items.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span>{t("admin.bazaPp.scanner.totalScanned", { count: result.total })}</span>
              <span className="text-emerald-600">
                {t("admin.bazaPp.scanner.statExact", { count: stats.exact })}
              </span>
              <span className="text-amber-600">
                {t("admin.bazaPp.scanner.statFuzzy", { count: stats.fuzzy })}
              </span>
              <span className="text-muted-foreground">
                {t("admin.bazaPp.scanner.statNone", { count: stats.none })}
              </span>
              <Button variant="outline" size="sm" onClick={exportCsv} className="ml-auto">
                <Download className="mr-2 h-3.5 w-3.5" />
                {t("admin.bazaPp.scanner.exportCsv")}
              </Button>
            </div>

            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          accepted.size > 0 &&
                          accepted.size ===
                            result.items.filter((i) => Object.keys(i.patch).length > 0).length
                        }
                        onCheckedChange={toggleAll}
                        aria-label={t("admin.bazaPp.selection.selectAll")}
                      />
                    </TableHead>
                    <TableHead>{t("admin.bazaPp.scanner.cols.entity")}</TableHead>
                    <TableHead>{t("admin.bazaPp.scanner.cols.confidence")}</TableHead>
                    <TableHead>{t("admin.bazaPp.scanner.cols.found")}</TableHead>
                    <TableHead>{t("admin.bazaPp.scanner.cols.patch")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((it) => {
                    const hasPatch = Object.keys(it.patch).length > 0;
                    return (
                      <TableRow key={it.entityId}>
                        <TableCell>
                          <Checkbox
                            checked={accepted.has(it.entityId)}
                            disabled={!hasPatch}
                            onCheckedChange={() => toggleOne(it.entityId)}
                            aria-label="Accept"
                          />
                        </TableCell>
                        <TableCell className="max-w-[260px]">
                          <div className="text-sm font-medium leading-tight">
                            {it.entity.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {it.entity.miejscowosc}
                            {it.entity.wojewodztwo ? ` · ${it.entity.wojewodztwo}` : ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          {confidenceBadge(it.confidence)}
                          {it.score !== undefined && (
                            <div className="text-xs text-muted-foreground">
                              {Math.round(it.score * 100)}%
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[260px] text-xs">
                          {it.match ? (
                            <>
                              <div className="font-medium leading-tight">{it.match.name}</div>
                              <div className="text-muted-foreground">{it.match.miejscowosc}</div>
                              {it.match.ade && <div>ADE: {it.match.ade}</div>}
                              {it.match.regon && <div>REGON: {it.match.regon}</div>}
                              {it.match.nip && <div>NIP: {it.match.nip}</div>}
                              {it.match.phone && <div>tel: {it.match.phone}</div>}
                              {it.match.email && <div>email: {it.match.email}</div>}
                              {it.match.www && <div>www: {it.match.www}</div>}
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell className="max-w-[260px] text-xs">
                          {hasPatch ? (
                            <ul className="space-y-0.5">
                              {Object.entries(it.patch).map(([k, v]) => (
                                <li key={k}>
                                  <span className="text-muted-foreground">{k}:</span>{" "}
                                  <span className="font-mono">{v}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-muted-foreground">
                              {t("admin.bazaPp.scanner.noChange")}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        </div>

        <DialogFooter className="shrink-0 flex items-center justify-between gap-2 border-t pt-3 sm:justify-between">
          {source === "bae" && (
            <a
              href="https://www.gov.pl/web/e-doreczenia/sprawdz-czy-twoj-urzad-korzysta-z-e-doreczen"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              gov.pl/e-doreczenia
            </a>
          )}
          {source === "rspo" && (
            <a
              href="https://rspo.gov.pl/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              rspo.gov.pl
            </a>
          )}

          <div className="flex gap-2">
            {running ? (
              <Button
                variant="outline"
                onClick={() => {
                  cancelRef.current = true;
                }}
              >
                {t("admin.bazaPp.scanner.live.stop")}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
            )}
            <Button
              disabled={!result || accepted.size === 0 || applyMut.isPending || running}
              onClick={() => applyMut.mutate()}
            >
              {applyMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("admin.bazaPp.scanner.applySelected", { count: accepted.size })}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
