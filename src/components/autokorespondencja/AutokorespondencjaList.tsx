// Concertivo — lista kampanii autokorespondencji + szybkie akcje status/usuń.
// Pełny kreator wieloetapowy z filtrami i harmonogramem dodamy w kolejnym etapie.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Play, Pause, Trash2, Pencil, X, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  listKampanie,
  setKampaniaStatus,
  deleteKampania,
} from "@/lib/autokorespondencje.functions";
import { AutokorespondencjaWizardDialog } from "./AutokorespondencjaWizardDialog";
import { SuppressionListsDialog } from "./SuppressionListsDialog";

interface Props {
  orgId: string;
}

interface Kampania {
  id: string;
  nazwa: string;
  status: string;
  temat: string;
  total_odbiorcow: number;
  created_at: string;
}

export function AutokorespondencjaList({ orgId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const listFn = useServerFn(listKampanie);
  const setStatusFn = useServerFn(setKampaniaStatus);
  const deleteFn = useServerFn(deleteKampania);

  const q = useQuery({
    queryKey: ["autokor", orgId],
    queryFn: () => listFn({ data: { organizationId: orgId } }),
  });
  const kampanie = (q.data?.kampanie ?? []) as unknown as Kampania[];

  const [wizardOpen, setWizardOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [listsOpen, setListsOpen] = useState(false);

  async function changeStatus(id: string, status: Kampania["status"]) {
    try {
      await setStatusFn({ data: { id, status: status as never } });
      qc.invalidateQueries({ queryKey: ["autokor", orgId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("correspondence.autokor.delete_confirm"))) return;
    try {
      await deleteFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["autokor", orgId] });
      toast.success(t("common.deleted"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  function statusVariant(s: string): "default" | "secondary" | "outline" | "destructive" {
    if (s === "running") return "default";
    if (s === "paused") return "secondary";
    if (s === "cancelled") return "destructive";
    return "outline";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold flex-1">{t("correspondence.autokor.title")}</h1>
        <Button variant="outline" onClick={() => setListsOpen(true)}>
          <ShieldOff className="h-4 w-4 mr-1" />
          {t("correspondence.lists.button")}
        </Button>
        <Button onClick={() => { setEditId(null); setWizardOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          {t("correspondence.autokor.new")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t("correspondence.autokor.subtitle")}</p>

      {q.isLoading && <div className="text-sm text-muted-foreground">{t("common.loading")}</div>}
      {kampanie.length === 0 && !q.isLoading && (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {t("correspondence.autokor.empty")}
        </div>
      )}
      <div className="grid gap-2">
        {kampanie.map((k) => (
          <Card key={k.id} className="p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium truncate">{k.nazwa}</div>
                <Badge variant={statusVariant(k.status)}>
                  {t(`correspondence.autokor.status.${k.status}`, k.status)}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {k.temat || "—"} • {t("correspondence.autokor.recipients", { count: k.total_odbiorcow })}
              </div>
            </div>
            {(k.status === "draft" || k.status === "paused") && (
              <Button variant="ghost" size="sm" onClick={() => changeStatus(k.id, "running")}>
                <Play className="h-4 w-4" />
              </Button>
            )}
            {k.status === "running" && (
              <Button variant="ghost" size="sm" onClick={() => changeStatus(k.id, "paused")}>
                <Pause className="h-4 w-4" />
              </Button>
            )}
            {(k.status === "running" || k.status === "paused" || k.status === "scheduled") && (
              <Button variant="ghost" size="sm" onClick={() => changeStatus(k.id, "cancelled")}>
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => { setEditId(k.id); setWizardOpen(true); }}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(k.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </Card>
        ))}
      </div>

      <AutokorespondencjaWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        orgId={orgId}
        editId={editId}
      />
    </div>
  );
}
