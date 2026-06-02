import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Copy, Check, Trash2, Webhook, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listWebWebhooks,
  upsertWebWebhook,
  deleteWebWebhook,
  listWebWebhookDeliveries,
  revealWebWebhookSecret,
  WEB_WEBHOOK_EVENTS,
} from "@/lib/web.functions";

type Hook = {
  id: string;
  name: string;
  target_url: string;
  events: string[];
  is_active: boolean;
};

export function WebWebhooksTab({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const fetchHooks = useServerFn(listWebWebhooks);
  const saveHook = useServerFn(upsertWebWebhook);
  const removeHook = useServerFn(deleteWebWebhook);
  const fetchDeliveries = useServerFn(listWebWebhookDeliveries);
  const revealSecret = useServerFn(revealWebWebhookSecret);

  const hooksQuery = useQuery({
    queryKey: ["web-webhooks", orgId],
    queryFn: () => fetchHooks({ data: { organizationId: orgId } }),
  });

  const [editing, setEditing] = useState<Hook | null>(null);
  const [open, setOpen] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [deliveriesFor, setDeliveriesFor] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: (h: Hook) =>
      saveHook({
        data: {
          id: h.id || undefined,
          organizationId: orgId,
          name: h.name,
          targetUrl: h.target_url,
          events: h.events as (typeof WEB_WEBHOOK_EVENTS)[number][],
          isActive: h.is_active,
        },
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["web-webhooks", orgId] });
      setOpen(false);
      setEditing(null);
      if (res.secret) setNewSecret(res.secret);
      else toast.success(t("common.saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => removeHook({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["web-webhooks", orgId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const hooks = (hooksQuery.data?.hooks ?? []) as Hook[];

  function startCreate() {
    setEditing({
      id: "",
      name: "",
      target_url: "",
      events: [...WEB_WEBHOOK_EVENTS],
      is_active: true,
    });
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{t("web.webhooks.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("web.webhooks.subtitle")}</p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t("web.webhooks.add")}
        </Button>
      </div>

      {hooks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("web.webhooks.empty")}</p>
      ) : (
        <div className="space-y-2">
          {hooks.map((h) => (
            <div key={h.id} className="rounded-md border border-border p-3">
              <div className="flex items-center gap-3">
                <Webhook className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {h.name} {!h.is_active && <span className="text-xs text-muted-foreground">({t("web.webhooks.inactive")})</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{h.target_url}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{h.events.length} {t("web.webhooks.events_count")}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setDeliveriesFor(h.id)}>
                  <Activity className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const r = await revealSecret({ data: { id: h.id } });
                    setNewSecret(r.secret);
                  }}
                >
                  {t("web.webhooks.show_secret")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(h); setOpen(true); }}>
                  {t("common.edit")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => delMut.mutate(h.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? t("common.edit") : t("web.webhooks.add")}</DialogTitle>
            <DialogDescription>{t("web.webhooks.form_help")}</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>{t("common.name")}</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>{t("web.webhooks.url")}</Label>
                <Input
                  value={editing.target_url}
                  onChange={(e) => setEditing({ ...editing, target_url: e.target.value })}
                  placeholder="https://example.com/hooks/concertivo"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.is_active}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
                <Label>{t("web.webhooks.active")}</Label>
              </div>
              <div>
                <Label>{t("web.webhooks.events")}</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {WEB_WEBHOOK_EVENTS.map((ev) => {
                    const checked = editing.events.includes(ev);
                    return (
                      <label key={ev} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = v
                              ? [...editing.events, ev]
                              : editing.events.filter((e) => e !== ev);
                            setEditing({ ...editing, events: next });
                          }}
                        />
                        <code className="text-xs">{ev}</code>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => editing && saveMut.mutate(editing)}
              disabled={!editing?.name.trim() || !editing?.target_url.trim() || editing.events.length === 0 || saveMut.isPending}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secret reveal */}
      <Dialog open={!!newSecret} onOpenChange={(o) => !o && setNewSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("web.webhooks.secret_title")}</DialogTitle>
            <DialogDescription>{t("web.webhooks.secret_desc")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3">
            <code className="flex-1 break-all font-mono text-xs">{newSecret}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (newSecret) navigator.clipboard.writeText(newSecret);
                toast.success(t("common.copied"));
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewSecret(null)}>{t("common.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliveries */}
      <DeliveriesDialog
        webhookId={deliveriesFor}
        onClose={() => setDeliveriesFor(null)}
        fetcher={(id) => fetchDeliveries({ data: { webhookId: id } })}
      />
    </div>
  );
}

function DeliveriesDialog({
  webhookId,
  onClose,
  fetcher,
}: {
  webhookId: string | null;
  onClose: () => void;
  fetcher: (id: string) => Promise<{ deliveries: Array<{ id: string; event: string; status_code: number | null; ok: boolean; error: string | null; duration_ms: number | null; created_at: string }> }>;
}) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["web-webhook-deliveries", webhookId],
    queryFn: () => fetcher(webhookId!),
    enabled: !!webhookId,
  });
  return (
    <Dialog open={!!webhookId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("web.webhooks.deliveries")}</DialogTitle>
        </DialogHeader>
        <div className="max-h-96 space-y-1 overflow-auto">
          {(q.data?.deliveries ?? []).map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-md border border-border p-2 text-xs">
              <span className={d.ok ? "text-green-600" : "text-destructive"}>
                {d.ok ? <Check className="h-3 w-3" /> : "✕"}
              </span>
              <code className="flex-1">{d.event}</code>
              <span>{d.status_code ?? "—"}</span>
              <span className="text-muted-foreground">{d.duration_ms ?? "—"}ms</span>
              <span className="text-muted-foreground">{new Date(d.created_at).toLocaleString()}</span>
            </div>
          ))}
          {q.data && q.data.deliveries.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">{t("web.webhooks.no_deliveries")}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
