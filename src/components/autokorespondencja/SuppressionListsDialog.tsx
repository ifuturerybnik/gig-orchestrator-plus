// Dialog z dwiema zakładkami: lista rezygnacji + lista odbić.
// Pozwala administracji przeglądać i usuwać wpisy (np. po wyjaśnieniu z odbiorcą).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  listRezygnacje,
  listOdbicia,
  deleteRezygnacja,
  deleteOdbicie,
} from "@/lib/email-tracking.functions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
}

export function SuppressionListsDialog({ open, onOpenChange, orgId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const rFn = useServerFn(listRezygnacje);
  const oFn = useServerFn(listOdbicia);
  const delRFn = useServerFn(deleteRezygnacja);
  const delOFn = useServerFn(deleteOdbicie);

  const rQ = useQuery({
    queryKey: ["rezygnacje", orgId, open],
    enabled: open,
    queryFn: () => rFn({ data: { organizationId: orgId } }),
  });
  const oQ = useQuery({
    queryKey: ["odbicia", orgId, open],
    enabled: open,
    queryFn: () => oFn({ data: { organizationId: orgId } }),
  });

  async function handleDelR(id: string) {
    try {
      await delRFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["rezygnacje", orgId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }
  async function handleDelO(id: string) {
    try {
      await delOFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["odbicia", orgId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("correspondence.lists.title")}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="rezygnacje" className="flex-1 overflow-hidden flex flex-col">
          <TabsList>
            <TabsTrigger value="rezygnacje">{t("correspondence.lists.rezygnacje")}</TabsTrigger>
            <TabsTrigger value="odbicia">{t("correspondence.lists.odbicia")}</TabsTrigger>
          </TabsList>
          <TabsContent value="rezygnacje" className="flex-1 overflow-y-auto">
            {rQ.isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
            {(rQ.data?.rows ?? []).length === 0 && !rQ.isLoading && (
              <p className="text-sm text-muted-foreground py-4">{t("correspondence.lists.empty")}</p>
            )}
            <div className="divide-y">
              {(rQ.data?.rows ?? []).map((r) => (
                <div key={r.id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="flex-1 truncate">{r.email}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.zgloszone_at as string).toLocaleDateString()}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => handleDelR(r.id as string)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="odbicia" className="flex-1 overflow-y-auto">
            {oQ.isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
            {(oQ.data?.rows ?? []).length === 0 && !oQ.isLoading && (
              <p className="text-sm text-muted-foreground py-4">{t("correspondence.lists.empty")}</p>
            )}
            <div className="divide-y">
              {(oQ.data?.rows ?? []).map((r) => (
                <div key={r.id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="flex-1 truncate">{r.email}</span>
                  <Badge variant="outline">{String(r.typ)}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.zgloszone_at as string).toLocaleDateString()}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => handleDelO(r.id as string)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
