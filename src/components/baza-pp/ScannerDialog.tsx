import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ExternalLink } from "lucide-react";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: ScannerSource;
  scope: ScannerScope;
  selectedIds: string[];
  onApplied?: () => void;
}

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

  const [result, setResult] = useState<ScanResult | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const scanMut = useMutation({
    mutationFn: async () => {
      const payload = { data: { scope, ids: scope === "selected" ? selectedIds : [] } };
      const res =
        source === "bae"
          ? await baeFn(payload)
          : source === "rspo"
            ? await rspoFn(payload)
            : await gusFn(payload);
      return res as ScanResult;
    },
    onSuccess: (res) => {
      setResult(res);
      const auto = new Set<string>();
      for (const it of res.items) {
        if (
          Object.keys(it.patch).length > 0 &&
          (it.confidence === "exact_regon" || it.confidence === "exact_name_city")
        ) {
          auto.add(it.entityId);
        }
      }
      setAccepted(auto);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : String(e));
    },
  });

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

  // Reset stanu przy otwarciu / zmianie źródła.
  useEffect(() => {
    if (open) {
      setResult(null);
      setAccepted(new Set());
      // Auto-start skanowania.
      scanMut.mutate();
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

  const sourceLabel = t(`admin.bazaPp.scanner.sources.${source}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>
            {t("admin.bazaPp.scanner.title", { source: sourceLabel })}
          </DialogTitle>
          <DialogDescription>
            {scope === "selected"
              ? t("admin.bazaPp.scanner.scopeSelected", { count: selectedIds.length })
              : t("admin.bazaPp.scanner.scopeMissing")}
          </DialogDescription>
        </DialogHeader>

        {scanMut.isPending && (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("admin.bazaPp.scanner.scanning")}
          </div>
        )}

        {result && stats && (
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
            </div>

            <div className="max-h-[55vh] overflow-auto rounded-md border">
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

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
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
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={!result || accepted.size === 0 || applyMut.isPending}
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
