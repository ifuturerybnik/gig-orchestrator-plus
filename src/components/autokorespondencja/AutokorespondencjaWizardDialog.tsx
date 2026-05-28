// Concertivo — uproszczony kreator kampanii autokorespondencji (MVP).
// Zawiera: nazwę, skrzynkę nadawczą, szablon, temat + body (WYSIWYG), filtry
// odbiorców (zrodlo + typy + tagi), harmonogram (godziny + dni + rate).
// Pełna wersja CRM Hub'a (segmentacja po koncertach/gatunkach, podgląd
// listy odbiorców, wykresy) dochodzi w kolejnym etapie.
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WysiwygEditor } from "@/components/ui/wysiwyg-editor";
import { listSkrzynki } from "@/lib/email-skrzynki.functions";
import { listSzablony } from "@/lib/email-szablony.functions";
import {
  getKampania,
  upsertKampania,
} from "@/lib/autokorespondencje.functions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  editId?: string | null;
}

const DAYS = [
  { v: 1, k: "pn" },
  { v: 2, k: "wt" },
  { v: 3, k: "sr" },
  { v: 4, k: "cz" },
  { v: 5, k: "pt" },
  { v: 6, k: "sb" },
  { v: 7, k: "nd" },
];

const ZRODLA = ["user_contacts", "org_contacts", "org_counterparties"] as const;
const TYPY = ["person", "company", "artist"] as const;

export function AutokorespondencjaWizardDialog({ open, onOpenChange, orgId, editId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const listSkrzynkiFn = useServerFn(listSkrzynki);
  const listSzablonyFn = useServerFn(listSzablony);
  const getKampaniaFn = useServerFn(getKampania);
  const upsertFn = useServerFn(upsertKampania);

  const skrzynkiQ = useQuery({
    queryKey: ["org-skrzynki", orgId, open],
    enabled: open,
    queryFn: () => listSkrzynkiFn({ data: { scope: "organization", organizationId: orgId } }),
  });
  const szablonyQ = useQuery({
    queryKey: ["szablony-all", orgId, open],
    enabled: open,
    queryFn: async () => {
      const [u, o] = await Promise.all([
        listSzablonyFn({ data: { scope: "user" } }),
        listSzablonyFn({ data: { scope: "organization", organizationId: orgId } }),
      ]);
      return [...(u.szablony ?? []), ...(o.szablony ?? [])];
    },
  });
  const editQ = useQuery({
    queryKey: ["autokor-edit", editId],
    enabled: open && !!editId,
    queryFn: () => getKampaniaFn({ data: { id: editId! } }),
  });

  const [nazwa, setNazwa] = useState("");
  const [skrzynkaId, setSkrzynkaId] = useState<string>("");
  const [szablonId, setSzablonId] = useState<string>("");
  const [temat, setTemat] = useState("");
  const [body, setBody] = useState("");
  const [zrodlo, setZrodlo] = useState<string[]>(["org_contacts"]);
  const [typy, setTypy] = useState<string[]>(["person"]);
  const [godzinyOd, setGodzinyOd] = useState("09:00");
  const [godzinyDo, setGodzinyDo] = useState("17:00");
  const [dni, setDni] = useState<number[]>([1, 2, 3, 4, 5]);
  const [rate, setRate] = useState(10);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editQ.data?.kampania) {
      const k = editQ.data.kampania as Record<string, unknown>;
      setNazwa(String(k.nazwa ?? ""));
      setSkrzynkaId(String(k.skrzynka_id ?? ""));
      setSzablonId(String(k.szablon_id ?? ""));
      setTemat(String(k.temat ?? ""));
      setBody(String(k.body_html ?? ""));
      const f = (k.filtry ?? {}) as Record<string, unknown>;
      setZrodlo(Array.isArray(f.zrodlo) ? (f.zrodlo as string[]) : ["org_contacts"]);
      setTypy(Array.isArray(f.typy) ? (f.typy as string[]) : ["person"]);
      setGodzinyOd(String(k.godziny_od ?? "09:00").slice(0, 5));
      setGodzinyDo(String(k.godziny_do ?? "17:00").slice(0, 5));
      setDni(Array.isArray(k.dni_tygodnia) ? (k.dni_tygodnia as number[]) : [1, 2, 3, 4, 5]);
      setRate(Number(k.rate_per_min ?? 10));
    } else if (!editId) {
      setNazwa("");
      setSkrzynkaId("");
      setSzablonId("");
      setTemat("");
      setBody("");
      setZrodlo(["org_contacts"]);
      setTypy(["person"]);
      setGodzinyOd("09:00");
      setGodzinyDo("17:00");
      setDni([1, 2, 3, 4, 5]);
      setRate(10);
    }
  }, [open, editQ.data, editId]);

  function applyTemplate(id: string) {
    setSzablonId(id);
    const s = szablonyQ.data?.find((x) => x.id === id);
    if (s) {
      if (s.temat) setTemat(s.temat);
      setBody(s.body_html || "");
    }
  }

  function toggleArr<T>(arr: T[], v: T, setter: (n: T[]) => void) {
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  }

  async function handleSave() {
    if (!nazwa.trim()) return toast.error(t("correspondence.autokor.name_required"));
    if (!skrzynkaId) return toast.error(t("correspondence.autokor.mailbox_required"));
    setSaving(true);
    try {
      await upsertFn({
        data: {
          id: editId ?? undefined,
          organizationId: orgId,
          skrzynkaId,
          nazwa: nazwa.trim(),
          temat,
          body_html: body,
          szablon_id: szablonId || null,
          filtry: { zrodlo, typy, wyklucz_rezygnacje: true, wyklucz_odbicia: true },
          godziny_od: godzinyOd,
          godziny_do: godzinyDo,
          dni_tygodnia: dni,
          rate_per_min: rate,
          timezone: "Europe/Warsaw",
        },
      });
      toast.success(t("common.saved"));
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["autokor", orgId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {editId
              ? t("correspondence.autokor.wizard.edit")
              : t("correspondence.autokor.wizard.new")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 flex-1 overflow-y-auto">
          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-1">
              <Label>{t("correspondence.autokor.wizard.name")}</Label>
              <Input value={nazwa} onChange={(e) => setNazwa(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label>{t("correspondence.autokor.wizard.mailbox")}</Label>
              <Select value={skrzynkaId} onValueChange={setSkrzynkaId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(skrzynkiQ.data?.skrzynki ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nazwa} ({s.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1">
            <Label>{t("correspondence.autokor.wizard.template")}</Label>
            <Select value={szablonId} onValueChange={applyTemplate}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {(szablonyQ.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.nazwa}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <Label>{t("correspondence.autokor.wizard.subject")}</Label>
            <Input value={temat} onChange={(e) => setTemat(e.target.value)} />
          </div>

          <div className="grid gap-1">
            <Label>{t("correspondence.autokor.wizard.body")}</Label>
            <WysiwygEditor value={body} onChange={setBody} minHeight="240px" />
          </div>

          <div className="rounded-md border border-border p-3 space-y-2">
            <div className="font-semibold text-sm">{t("correspondence.autokor.wizard.filters")}</div>
            <div>
              <Label className="text-xs">{t("correspondence.autokor.wizard.sources")}</Label>
              <div className="flex flex-wrap gap-3 mt-1">
                {ZRODLA.map((z) => (
                  <label key={z} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={zrodlo.includes(z)}
                      onCheckedChange={() => toggleArr(zrodlo, z, setZrodlo)}
                    />
                    {t(`correspondence.autokor.wizard.source.${z}`)}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">{t("correspondence.autokor.wizard.types")}</Label>
              <div className="flex flex-wrap gap-3 mt-1">
                {TYPY.map((tt) => (
                  <label key={tt} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={typy.includes(tt)}
                      onCheckedChange={() => toggleArr(typy, tt, setTypy)}
                    />
                    {t(`correspondence.autokor.wizard.type.${tt}`)}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border p-3 space-y-2">
            <div className="font-semibold text-sm">{t("correspondence.autokor.wizard.schedule")}</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-1">
                <Label className="text-xs">{t("correspondence.autokor.wizard.hours_from")}</Label>
                <Input type="time" value={godzinyOd} onChange={(e) => setGodzinyOd(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">{t("correspondence.autokor.wizard.hours_to")}</Label>
                <Input type="time" value={godzinyDo} onChange={(e) => setGodzinyDo(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">{t("correspondence.autokor.wizard.rate")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value) || 10)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">{t("correspondence.autokor.wizard.days")}</Label>
              <div className="flex flex-wrap gap-3 mt-1">
                {DAYS.map((d) => (
                  <label key={d.v} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={dni.includes(d.v)}
                      onCheckedChange={() => toggleArr(dni, d.v, setDni)}
                    />
                    {t(`correspondence.autokor.wizard.day.${d.k}`)}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("common.loading") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
