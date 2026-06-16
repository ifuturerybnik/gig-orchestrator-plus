import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, FileText } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  startGusScanJob,
  getGusScanJob,
  listMyGusScanJobs,
  cancelGusScanJob,
  GUS_SCAN_FIELDS,
  type GusScanField,
} from "@/lib/gus-scan.functions";
import { downloadGusScanReportPdf } from "@/lib/gus-scan-report";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onApplied?: () => void;
}

const FIELD_LABELS: Record<GusScanField, string> = {
  nip: "NIP",
  regon: "REGON",
  krs: "KRS",
  name: "Nazwa",
  wojewodztwo: "Województwo",
  powiat: "Powiat",
  gmina: "Gmina",
  miejscowosc: "Miejscowość",
  kod_pocztowy: "Kod poczt.",
  poczta: "Poczta",
  ulica: "Ulica",
  nr_domu: "Nr",
};

const DEFAULT_FIELDS: GusScanField[] = [
  "nip",
  "regon",
  "krs",
  "name",
  "wojewodztwo",
  "powiat",
  "gmina",
  "miejscowosc",
  "kod_pocztowy",
  "ulica",
  "nr_domu",
];

type Step = "config" | "running";

type GusScanJob = {
  id: string;
  identifier: "nip" | "regon" | "krs";
  fields: string[];
  status: string;
  total: number;
  processed: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  log: Array<{ ts: number; level: string; text: string }>;
  changes: Array<{
    entity_id: string;
    name: string | null;
    result: "updated" | "skipped" | "error";
    fields?: Record<string, { from: string | null; to: string | null }>;
    reason?: string;
  }>;
  created_at: string;
  finished_at: string | null;
};

type GusScanJobSummary = Pick<
  GusScanJob,
  | "id"
  | "identifier"
  | "total"
  | "processed"
  | "updated_count"
  | "skipped_count"
  | "error_count"
  | "status"
  | "created_at"
  | "finished_at"
>;

export function GusScanDialog({ open, onOpenChange, selectedIds, onApplied }: Props) {
  const { t: _t } = useTranslation();
  const qc = useQueryClient();
  const startFn = useServerFn(startGusScanJob);
  const getFn = useServerFn(getGusScanJob);
  const listFn = useServerFn(listMyGusScanJobs);
  const cancelFn = useServerFn(cancelGusScanJob);

  const [identifier, setIdentifier] = useState<"nip" | "regon" | "krs">("nip");
  const [fields, setFields] = useState<Set<GusScanField>>(new Set(DEFAULT_FIELDS));
  const [scope, setScope] = useState<"selected" | "all">(selectedIds.length > 0 ? "selected" : "all");
  const [step, setStep] = useState<Step>("config");
  const [jobId, setJobId] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setStep("config");
      setJobId(null);
      setScope(selectedIds.length > 0 ? "selected" : "all");
    }
    // Celowo bez `selectedIds.length` — reset tylko przy otwarciu dialogu,
    // żeby wyczyszczenie zaznaczenia przez onApplied nie zamknęło raportu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggleField = (f: GusScanField) =>
    setFields((prev) => {
      const n = new Set(prev);
      if (n.has(f)) n.delete(f);
      else n.add(f);
      return n;
    });

  const startMut = useMutation({
    mutationFn: async () => {
      if (fields.size === 0) throw new Error("Zaznacz co najmniej jedno pole do uzupełnienia.");
      return await startFn({
        data: {
          identifier,
          fields: Array.from(fields),
          scope,
          ids: scope === "selected" ? selectedIds : undefined,
        },
      });
    },
    onSuccess: (r) => {
      setJobId(r.jobId);
      setStep("running");
      qc.invalidateQueries({ queryKey: ["gus-scan-jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const jobsQuery = useQuery({
    queryKey: ["gus-scan-jobs"],
    queryFn: () => listFn(),
    enabled: open,
    refetchInterval: open && step === "config" ? 10_000 : false,
  });

  const jobQuery = useQuery({
    queryKey: ["gus-scan-job", jobId],
    queryFn: () => getFn({ data: { jobId: jobId! } }),
    enabled: !!jobId && step === "running",
    refetchInterval: (q) => {
      const status = q.state.data?.job?.status;
      if (status === "done" || status === "cancelled" || status === "error") return false;
      return 2000;
    },
  });

  const job = jobQuery.data?.job as
    | {
        id: string;
        identifier: "nip" | "regon" | "krs";
        fields: string[];
        status: string;
        total: number;
        processed: number;
        updated_count: number;
        skipped_count: number;
        error_count: number;
        log: Array<{ ts: number; level: string; text: string }>;
        changes: Array<{
          entity_id: string;
          name: string | null;
          result: "updated" | "skipped" | "error";
          fields?: Record<string, { from: string | null; to: string | null }>;
          reason?: string;
        }>;
        created_at: string;
        finished_at: string | null;
      }
    | undefined;

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [job?.log?.length]);

  const appliedFiredRef = useRef(false);
  useEffect(() => {
    if (job?.status === "done" && !appliedFiredRef.current) {
      appliedFiredRef.current = true;
      onApplied?.();
    }
    if (job?.status && job.status !== "done") appliedFiredRef.current = false;
    // celowo bez `onApplied` w depach — inline callback w rodzicu zmienia ref przy każdym renderze
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status]);

  const pct = useMemo(() => {
    if (!job || job.total === 0) return 0;
    return Math.round((job.processed / job.total) * 100);
  }, [job]);

  const isTerminal = job && ["done", "cancelled", "error"].includes(job.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-3 overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Skaner GUS REGON — BIR1.1</DialogTitle>
          <DialogDescription>
            Aplikacja wyszuka rekordy w GUS po wybranym identyfikatorze i uzupełni / poprawi zaznaczone
            pola. Zlecenie działa w tle — możesz zamknąć okno lub się wylogować.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
          {step === "config" && (
            <>
              <div className="rounded-md border p-3">
                <Label className="text-sm font-semibold">Zakres</Label>
                <RadioGroup
                  value={scope}
                  onValueChange={(v) => setScope(v as "selected" | "all")}
                  className="mt-2 space-y-1"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="selected" disabled={selectedIds.length === 0} />
                    Zaznaczone rekordy ({selectedIds.length})
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="all" />
                    Wszystkie rekordy z wybranym identyfikatorem
                  </label>
                </RadioGroup>
              </div>

              <div className="rounded-md border p-3">
                <Label className="text-sm font-semibold">Skanuj po</Label>
                <RadioGroup
                  value={identifier}
                  onValueChange={(v) => setIdentifier(v as "nip" | "regon" | "krs")}
                  className="mt-2 grid grid-cols-3 gap-2"
                >
                  {(["nip", "regon", "krs"] as const).map((id) => (
                    <label key={id} className="flex items-center gap-2 rounded border p-2 text-sm">
                      <RadioGroupItem value={id} />
                      {id.toUpperCase()}
                    </label>
                  ))}
                </RadioGroup>
                <p className="mt-2 text-xs text-muted-foreground">
                  Rekordy bez wybranego identyfikatora zostaną pominięte (z adnotacją w raporcie).
                </p>
              </div>

              <div className="rounded-md border p-3">
                <Label className="text-sm font-semibold">
                  Uzupełnij / popraw pola ({fields.size})
                </Label>
                <p className="mb-2 text-xs text-muted-foreground">
                  Pole jest aktualizowane tylko, gdy w bazie jest puste lub różni się od wartości
                  zwróconej przez GUS.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {GUS_SCAN_FIELDS.map((f) => (
                    <label key={f} className="flex items-center gap-2 rounded border p-2 text-sm">
                      <Checkbox checked={fields.has(f)} onCheckedChange={() => toggleField(f)} />
                      {FIELD_LABELS[f]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-amber-300/50 bg-amber-50/40 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                Limit GUS: 1 zapytanie / sekundę (globalny throttle). Dla 1000 rekordów scan trwa ~17
                min. Worker przetwarza paczki co minutę — możesz bezpiecznie zamknąć przeglądarkę.
              </div>
            </>
          )}

          {step === "running" && (
            <>
              <div className="flex items-center gap-3">
                {job && !isTerminal && <Loader2 className="h-4 w-4 animate-spin" />}
                <span className="text-sm text-muted-foreground">
                  {!job
                    ? "Ładowanie zlecenia…"
                    : isTerminal
                      ? `Status: ${job.status}`
                      : `Postęp: ${job.processed}/${job.total} (${pct}%)`}
                </span>
              </div>
              {job && <Progress value={pct} />}
              {job && (
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <Stat label="Łącznie" value={job.total} />
                  <Stat label="Zaktualizowane" value={job.updated_count} tone="ok" />
                  <Stat label="Pominięte" value={job.skipped_count} tone="warn" />
                  <Stat label="Błędy" value={job.error_count} tone="err" />
                </div>
              )}

              <div
                ref={logRef}
                className="max-h-72 overflow-auto rounded-md border bg-muted/30 p-2 font-mono text-xs"
              >
                {(job?.log ?? []).map((l, i) => (
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
                {!job?.log?.length && (
                  <div className="text-muted-foreground">Brak wpisów (jeszcze).</div>
                )}
              </div>

              {isTerminal && job && (
                <div className="rounded-md border p-3 text-sm">
                  <div className="mb-2 font-semibold">Raport zmian</div>
                  <div className="max-h-60 overflow-auto rounded border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="p-2 text-left">Rekord</th>
                          <th className="p-2 text-left">Wynik</th>
                          <th className="p-2 text-left">Szczegóły</th>
                        </tr>
                      </thead>
                      <tbody>
                        {job.changes.map((c, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2">{c.name ?? "—"}</td>
                            <td className="p-2">
                              <span
                                className={
                                  c.result === "updated"
                                    ? "text-emerald-600"
                                    : c.result === "error"
                                      ? "text-destructive"
                                      : "text-muted-foreground"
                                }
                              >
                                {c.result}
                              </span>
                            </td>
                            <td className="p-2">
                              {c.result === "updated" && c.fields ? (
                                <ul className="space-y-0.5">
                                  {Object.entries(c.fields).map(([k, v]) => (
                                    <li key={k}>
                                      <span className="text-muted-foreground">
                                        {FIELD_LABELS[k as GusScanField] ?? k}:
                                      </span>{" "}
                                      <span className="line-through opacity-60">
                                        {v.from ?? "—"}
                                      </span>{" "}
                                      → <span className="font-mono">{v.to ?? "—"}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-muted-foreground">{c.reason ?? ""}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t pt-3">
          {step === "config" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Anuluj
              </Button>
              <Button onClick={() => startMut.mutate()} disabled={startMut.isPending}>
                {startMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Rozpocznij skanowanie
              </Button>
            </>
          )}
          {step === "running" && (
            <>
              {!isTerminal && jobId && (
                <Button
                  variant="outline"
                  onClick={() =>
                    cancelFn({ data: { jobId } }).then(() => jobQuery.refetch())
                  }
                >
                  Przerwij
                </Button>
              )}
              {isTerminal && job && (
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadGusScanReportPdf({
                      id: job.id,
                      identifier: job.identifier,
                      fields: job.fields,
                      total: job.total,
                      processed: job.processed,
                      updated_count: job.updated_count,
                      skipped_count: job.skipped_count,
                      error_count: job.error_count,
                      created_at: job.created_at,
                      finished_at: job.finished_at,
                      changes: job.changes,
                    })
                  }
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Pobierz raport PDF
                </Button>
              )}
              <Button onClick={() => onOpenChange(false)}>Zamknij</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "err";
}) {
  const color =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "err"
          ? "text-destructive"
          : "";
  return (
    <div className="rounded border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}


