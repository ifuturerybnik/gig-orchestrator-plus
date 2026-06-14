import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Download, Search, Sparkles } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { discoverBaeByKeyword } from "@/lib/scanners.functions";
import { callAi } from "@/lib/ai.functions";
import {
  PUBLIC_ENTITY_TYPES,
  type PublicEntityType,
  commitPublicEntitiesImport,
} from "@/lib/public-entities.functions";

const WOJEWODZTWA = [
  "dolnośląskie","kujawsko-pomorskie","lubelskie","lubuskie","łódzkie",
  "małopolskie","mazowieckie","opolskie","podkarpackie","podlaskie",
  "pomorskie","śląskie","świętokrzyskie","warmińsko-mazurskie",
  "wielkopolskie","zachodniopomorskie",
];

interface DiscoverItem {
  bae: {
    name: string;
    miejscowosc: string;
    wojewodztwo: string;
    regon: string;
    ade: string;
  };
  existingEntityId: string | null;
  matchedBy: "regon" | "ade" | "name_city" | null;
}

interface DiscoverResult {
  keyword: string;
  total: number;
  existing: number;
  missing: number;
  items: DiscoverItem[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied?: () => void;
}

export function KeywordDiscoveryDialog({ open, onOpenChange, onApplied }: Props) {
  const { t } = useTranslation();
  const discoverFn = useServerFn(discoverBaeByKeyword);
  const callAiFn = useServerFn(callAi);

  const [keyword, setKeyword] = useState("kultury");
  const [wojewodztwo, setWojewodztwo] = useState<string>("all");
  const [entityType, setEntityType] = useState<PublicEntityType>("osrodek_kultury");
  const [showOnlyMissing, setShowOnlyMissing] = useState(true);
  const [result, setResult] = useState<DiscoverResult | null>(null);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) {
      setResult(null);
      setAccepted(new Set());
    }
  }, [open]);

  const runMut = useMutation({
    mutationFn: async () => {
      return (await discoverFn({
        data: {
          keyword,
          wojewodztwo: wojewodztwo === "all" ? null : wojewodztwo,
        },
      })) as DiscoverResult;
    },
    onSuccess: (res) => {
      setResult(res);
      const auto = new Set<number>();
      res.items.forEach((it, i) => {
        if (!it.existingEntityId) auto.add(i);
      });
      setAccepted(auto);
      toast.success(
        t("admin.bazaPp.discover.scanned", {
          total: res.total,
          missing: res.missing,
        }),
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyMut = useMutation({
    mutationFn: async () => {
      if (!result) return { inserted: 0, updated: 0, errors: [] as unknown[] };
      const rows = Array.from(accepted)
        .map((i) => result.items[i])
        .filter((it) => it && !it.existingEntityId)
        .map((it) => ({
          entity_type: entityType,
          name: it.bae.name || "(brak nazwy)",
          miejscowosc: it.bae.miejscowosc || null,
          wojewodztwo: it.bae.wojewodztwo?.toLowerCase() || null,
          regon: it.bae.regon || null,
          edoreczenia_ade: it.bae.ade || null,
        }));
      if (rows.length === 0) {
        return { inserted: 0, updated: 0, errors: [] as unknown[] };
      }
      return await importFn({
        data: {
          rows,
          source: `discover:bae:${keyword}:${new Date().toISOString().slice(0, 10)}`,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(
        t("admin.bazaPp.discover.added", {
          inserted: res.inserted,
          errors: res.errors.length,
        }),
      );
      onApplied?.();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visibleItems = useMemo(() => {
    if (!result) return [];
    return result.items
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => (showOnlyMissing ? !it.existingEntityId : true));
  }, [result, showOnlyMissing]);

  const missingIndices = useMemo(() => {
    if (!result) return [] as number[];
    return result.items
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => !it.existingEntityId)
      .map(({ i }) => i);
  }, [result]);

  const allMissingChecked =
    missingIndices.length > 0 && missingIndices.every((i) => accepted.has(i));

  const toggleAllMissing = () => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (allMissingChecked) missingIndices.forEach((i) => next.delete(i));
      else missingIndices.forEach((i) => next.add(i));
      return next;
    });
  };

  const toggleOne = (i: number) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const exportCsv = () => {
    if (!result) return;
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ["status", "matched_by", "name", "miejscowosc", "wojewodztwo", "regon", "ade"];
    const rows = result.items.map((it) => [
      it.existingEntityId ? "in_base" : "to_add",
      it.matchedBy ?? "",
      it.bae.name,
      it.bae.miejscowosc,
      it.bae.wojewodztwo,
      it.bae.regon,
      it.bae.ade,
    ]);
    const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href = url;
    a.download = `discover-bae-${keyword}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!top-4 !bottom-4 !grid !h-auto !max-h-none !translate-y-0 max-w-6xl grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden sm:!top-8 sm:!bottom-8">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t("admin.bazaPp.discover.title")}</DialogTitle>
          <DialogDescription>{t("admin.bazaPp.discover.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pr-1">
          <div className="shrink-0 grid gap-3 rounded-md border bg-muted/30 p-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label>{t("admin.bazaPp.discover.keyword")}</Label>
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="kultury"
              />
            </div>
            <div>
              <Label>{t("admin.bazaPp.filters.wojewodztwo")}</Label>
              <Select value={wojewodztwo} onValueChange={setWojewodztwo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.bazaPp.filters.all")}</SelectItem>
                  {WOJEWODZTWA.map((w) => (
                    <SelectItem key={w} value={w}>{w}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("admin.bazaPp.discover.entityType")}</Label>
              <Select
                value={entityType}
                onValueChange={(v) => setEntityType(v as PublicEntityType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PUBLIC_ENTITY_TYPES.map((typ) => (
                    <SelectItem key={typ} value={typ}>
                      {t(`admin.bazaPp.types.${typ}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-4 flex items-center justify-end gap-2">
              <Button
                onClick={() => runMut.mutate()}
                disabled={runMut.isPending || keyword.trim().length < 2}
              >
                {runMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                {t("admin.bazaPp.discover.run")}
              </Button>
            </div>
          </div>

          {result && (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span>{t("admin.bazaPp.discover.statTotal", { count: result.total })}</span>
                <span className="text-muted-foreground">
                  {t("admin.bazaPp.discover.statExisting", { count: result.existing })}
                </span>
                <span className="text-emerald-600">
                  {t("admin.bazaPp.discover.statMissing", { count: result.missing })}
                </span>
                <label className="ml-4 flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={showOnlyMissing}
                    onCheckedChange={(v) => setShowOnlyMissing(v === true)}
                  />
                  {t("admin.bazaPp.discover.onlyMissing")}
                </label>
                <Button variant="outline" size="sm" onClick={exportCsv} className="ml-auto">
                  <Download className="mr-2 h-3.5 w-3.5" />
                  {t("admin.bazaPp.scanner.exportCsv")}
                </Button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allMissingChecked}
                          onCheckedChange={toggleAllMissing}
                          aria-label="select all missing"
                        />
                      </TableHead>
                      <TableHead>{t("admin.bazaPp.discover.cols.status")}</TableHead>
                      <TableHead>{t("admin.bazaPp.cols.name")}</TableHead>
                      <TableHead>{t("admin.bazaPp.cols.miejscowosc")}</TableHead>
                      <TableHead>{t("admin.bazaPp.cols.wojewodztwo")}</TableHead>
                      <TableHead>REGON</TableHead>
                      <TableHead>ADE</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          {t("admin.bazaPp.empty")}
                        </TableCell>
                      </TableRow>
                    )}
                    {visibleItems.map(({ it, i }) => {
                      const isExisting = !!it.existingEntityId;
                      return (
                        <TableRow key={i}>
                          <TableCell>
                            <Checkbox
                              checked={accepted.has(i)}
                              disabled={isExisting}
                              onCheckedChange={() => toggleOne(i)}
                              aria-label="accept"
                            />
                          </TableCell>
                          <TableCell>
                            {isExisting ? (
                              <Badge variant="outline">
                                {t("admin.bazaPp.discover.status.inBase")}
                                {it.matchedBy && (
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    ({it.matchedBy})
                                  </span>
                                )}
                              </Badge>
                            ) : (
                              <Badge>{t("admin.bazaPp.discover.status.toAdd")}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{it.bae.name}</TableCell>
                          <TableCell>{it.bae.miejscowosc}</TableCell>
                          <TableCell className="text-xs">{it.bae.wojewodztwo}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">{it.bae.regon}</TableCell>
                          <TableCell className="max-w-[220px] truncate text-xs">{it.bae.ade}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t bg-background pt-3 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!result || accepted.size === 0 || applyMut.isPending}
            onClick={() => applyMut.mutate()}
          >
            {applyMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("admin.bazaPp.discover.addSelected", { count: accepted.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
