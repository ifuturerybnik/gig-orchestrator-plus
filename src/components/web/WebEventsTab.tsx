import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { WebTabInstructions } from "@/components/web/WebTabInstructions";

import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Globe, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ImageUploader, type UploadedImage } from "@/components/ui/image-uploader";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WysiwygEditor } from "@/components/ui/wysiwyg-editor";
import {
  listWebEvents,
  getWebEventItem,
  upsertWebEvent,
  deleteWebEvent,
  WEB_EVENT_STATUSES,
} from "@/lib/web.functions";

type Lang = "pl" | "en";

interface EventListItem {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  cover_image_url: string | null;
  starts_at: string;
  ends_at: string | null;
  status: string;
  is_public: boolean;
  ticket_url: string | null;
}

export function WebEventsTab({ orgId }: { orgId: string }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const fetchList = useServerFn(listWebEvents);

  const listQuery = useQuery({
    queryKey: ["web-events", orgId],
    queryFn: () => fetchList({ data: { organizationId: orgId } }),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteFn = useServerFn(deleteWebEvent);
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success(t("web.events.deleted"));
      qc.invalidateQueries({ queryKey: ["web-events", orgId] });
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lang = (i18n.language?.startsWith("en") ? "en" : "pl") as Lang;
  const items = (listQuery.data?.events ?? []) as EventListItem[];

  return (
    <div className="space-y-4">
      <WebTabInstructions tab="events" />
      <div className="flex items-center justify-between">

        <div>
          <h2 className="text-lg font-semibold">{t("web.events.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("web.events.subtitle")}</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" /> {t("web.events.add")}
        </Button>
      </div>

      {listQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("web.events.empty")}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div
              key={it.id}
              className="flex items-center gap-3 rounded-md border border-border bg-card p-3"
            >
              {it.cover_image_url ? (
                <img src={it.cover_image_url} alt="" className="h-14 w-20 shrink-0 rounded object-cover" />
              ) : (
                <div className="h-14 w-20 shrink-0 rounded bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">
                    {it.title_i18n?.[lang] || it.title_i18n?.pl || it.slug}
                  </p>
                  {it.is_public ? (
                    <Badge variant="default" className="gap-1">
                      <Globe className="h-3 w-3" />
                      {t("web.news.published")}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <EyeOff className="h-3 w-3" />
                      {t("web.news.draft")}
                    </Badge>
                  )}
                  {it.status !== "scheduled" && (
                    <Badge variant="outline">{t(`web.events.status.${it.status}`)}</Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {new Date(it.starts_at).toLocaleString()} · /{it.slug}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setEditingId(it.id)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setDeleteId(it.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {(creating || editingId) && (
        <EventEditorDialog
          orgId={orgId}
          eventId={editingId}
          onClose={() => {
            setCreating(false);
            setEditingId(null);
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["web-events", orgId] });
            setCreating(false);
            setEditingId(null);
          }}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("web.events.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("web.events.delete_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ----------------- Editor dialog -----------------

interface Performer {
  name: string;
  url: string;
}

interface EventForm {
  slug: string;
  title: Record<Lang, string>;
  description: Record<Lang, string>;
  locationName: Record<Lang, string>;
  coverImageUrl: string;
  startsAt: string; // local datetime
  endsAt: string;
  timezone: string;
  locationAddress: string;
  performers: Performer[];
  ticketUrl: string;
  ticketPriceFrom: string;
  currency: string;
  status: (typeof WEB_EVENT_STATUSES)[number];
  isPublic: boolean;
}

function toLocal(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyEvent: EventForm = {
  slug: "",
  title: { pl: "", en: "" },
  description: { pl: "", en: "" },
  locationName: { pl: "", en: "" },
  coverImageUrl: "",
  startsAt: "",
  endsAt: "",
  timezone: "Europe/Warsaw",
  locationAddress: "",
  performers: [],
  ticketUrl: "",
  ticketPriceFrom: "",
  currency: "PLN",
  status: "scheduled",
  isPublic: false,
};

function EventEditorDialog({
  orgId,
  eventId,
  onClose,
  onSaved,
}: {
  orgId: string;
  eventId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const fetchItem = useServerFn(getWebEventItem);
  const saveFn = useServerFn(upsertWebEvent);
  const [form, setForm] = useState<EventForm>(emptyEvent);
  const [activeLang, setActiveLang] = useState<Lang>("pl");
  const [initialized, setInitialized] = useState(false);

  useQuery({
    queryKey: ["web-event-item", eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const res = await fetchItem({ data: { id: eventId } });
      const it = res.item as Record<string, unknown>;
      const title = (it.title_i18n as Record<string, string>) ?? {};
      const desc = (it.description_html_i18n as Record<string, string>) ?? {};
      const loc = (it.location_name_i18n as Record<string, string>) ?? {};
      const performers = Array.isArray(it.performers)
        ? (it.performers as Performer[])
        : [];
      setForm({
        slug: String(it.slug ?? ""),
        title: { pl: title.pl ?? "", en: title.en ?? "" },
        description: { pl: desc.pl ?? "", en: desc.en ?? "" },
        locationName: { pl: loc.pl ?? "", en: loc.en ?? "" },
        coverImageUrl: String(it.cover_image_url ?? ""),
        startsAt: toLocal(it.starts_at as string | null),
        endsAt: toLocal(it.ends_at as string | null),
        timezone: String(it.timezone ?? "Europe/Warsaw"),
        locationAddress: String(it.location_address ?? ""),
        performers,
        ticketUrl: String(it.ticket_url ?? ""),
        ticketPriceFrom: it.ticket_price_from != null ? String(it.ticket_price_from) : "",
        currency: String(it.currency ?? "PLN"),
        status: ((it.status as EventForm["status"]) ?? "scheduled"),
        isPublic: Boolean(it.is_public),
      });
      setInitialized(true);
      return res;
    },
    enabled: !!eventId,
    staleTime: 0,
  });

  if (!eventId && !initialized) {
    setForm(emptyEvent);
    setInitialized(true);
  }

  const saveMut = useMutation({
    mutationFn: () => {
      if (!form.startsAt) throw new Error(t("web.events.start_required"));
      const startIso = new Date(form.startsAt).toISOString();
      const endIso = form.endsAt ? new Date(form.endsAt).toISOString() : null;
      return saveFn({
        data: {
          id: eventId ?? undefined,
          organizationId: orgId,
          slug: form.slug.trim() || undefined,
          titleI18n: { pl: form.title.pl, en: form.title.en },
          descriptionHtmlI18n: { pl: form.description.pl, en: form.description.en },
          locationNameI18n: { pl: form.locationName.pl, en: form.locationName.en },
          coverImageUrl: form.coverImageUrl.trim() || null,
          startsAt: startIso,
          endsAt: endIso,
          timezone: form.timezone || "Europe/Warsaw",
          locationAddress: form.locationAddress.trim() || null,
          performers: form.performers
            .filter((p) => p.name.trim())
            .map((p) => ({ name: p.name.trim(), url: p.url.trim() || undefined })),
          ticketUrl: form.ticketUrl.trim() || null,
          ticketPriceFrom: form.ticketPriceFrom ? Number(form.ticketPriceFrom) : null,
          currency: form.currency.trim() || null,
          status: form.status,
          isPublic: form.isPublic,
        },
      });
    },
    onSuccess: () => {
      toast.success(t("web.events.saved"));
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{eventId ? t("web.events.edit") : t("web.events.add")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("web.news.cover_url")}</Label>
              <Input
                value={form.coverImageUrl}
                onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>{t("web.events.starts_at")}</Label>
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("web.events.ends_at")}</Label>
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("web.events.timezone")}</Label>
              <Input
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("web.events.status_label")}</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as EventForm["status"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEB_EVENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`web.events.status.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("web.news.slug")}</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder={t("web.news.slug_placeholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("web.events.location_address")}</Label>
              <Input
                value={form.locationAddress}
                onChange={(e) => setForm({ ...form, locationAddress: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("web.events.ticket_url")}</Label>
              <Input
                value={form.ticketUrl}
                onChange={(e) => setForm({ ...form, ticketUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>{t("web.events.ticket_price_from")}</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={form.ticketPriceFrom}
                  onChange={(e) => setForm({ ...form, ticketPriceFrom: e.target.value })}
                />
                <Input
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="w-20"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("web.events.performers")}</Label>
            <div className="space-y-2">
              {form.performers.map((p, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    placeholder={t("web.events.performer_name")}
                    value={p.name}
                    onChange={(e) => {
                      const arr = [...form.performers];
                      arr[idx] = { ...arr[idx], name: e.target.value };
                      setForm({ ...form, performers: arr });
                    }}
                  />
                  <Input
                    placeholder="https://..."
                    value={p.url}
                    onChange={(e) => {
                      const arr = [...form.performers];
                      arr[idx] = { ...arr[idx], url: e.target.value };
                      setForm({ ...form, performers: arr });
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setForm({ ...form, performers: form.performers.filter((_, i) => i !== idx) })
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm({ ...form, performers: [...form.performers, { name: "", url: "" }] })
                }
              >
                <Plus className="mr-2 h-4 w-4" /> {t("web.events.add_performer")}
              </Button>
            </div>
          </div>

          <Tabs value={activeLang} onValueChange={(v) => setActiveLang(v as Lang)}>
            <TabsList>
              <TabsTrigger value="pl">PL</TabsTrigger>
              <TabsTrigger value="en">EN</TabsTrigger>
            </TabsList>
            {(["pl", "en"] as Lang[]).map((l) => (
              <TabsContent key={l} value={l} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("web.news.title_field")} ({l.toUpperCase()})</Label>
                  <Input
                    value={form.title[l]}
                    onChange={(e) =>
                      setForm({ ...form, title: { ...form.title, [l]: e.target.value } })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("web.events.location_name")} ({l.toUpperCase()})</Label>
                  <Input
                    value={form.locationName[l]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        locationName: { ...form.locationName, [l]: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("web.events.description")} ({l.toUpperCase()})</Label>
                  <WysiwygEditor
                    value={form.description[l]}
                    onChange={(html) =>
                      setForm({
                        ...form,
                        description: { ...form.description, [l]: html },
                      })
                    }
                    minHeight="240px"
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3">
            <Switch
              checked={form.isPublic}
              onCheckedChange={(c) => setForm({ ...form, isPublic: c })}
            />
            <div>
              <p className="text-sm font-medium">{t("web.news.publish")}</p>
              <p className="text-xs text-muted-foreground">{t("web.news.publish_help")}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
