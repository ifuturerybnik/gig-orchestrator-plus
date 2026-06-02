import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Globe,
  EyeOff,
  Images,
  Video,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import {
  listWebAlbums,
  getWebAlbum,
  upsertWebAlbum,
  deleteWebAlbum,
  upsertWebGalleryItem,
  deleteWebGalleryItem,
} from "@/lib/web.functions";

type Lang = "pl" | "en";

interface AlbumListItem {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  cover_image_url: string | null;
  is_public: boolean;
  published_at: string | null;
}

export function WebGalleryTab({ orgId }: { orgId: string }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const fetchList = useServerFn(listWebAlbums);
  const lang = (i18n.language?.startsWith("en") ? "en" : "pl") as Lang;

  const [openAlbumId, setOpenAlbumId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["web-albums", orgId],
    queryFn: () => fetchList({ data: { organizationId: orgId } }),
  });

  const deleteFn = useServerFn(deleteWebAlbum);
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success(t("web.gallery.album_deleted"));
      qc.invalidateQueries({ queryKey: ["web-albums", orgId] });
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const albums = (listQuery.data?.albums ?? []) as AlbumListItem[];

  if (openAlbumId) {
    return (
      <AlbumDetail
        orgId={orgId}
        albumId={openAlbumId}
        onBack={() => setOpenAlbumId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("web.gallery.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("web.gallery.subtitle")}</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" /> {t("web.gallery.add_album")}
        </Button>
      </div>

      {listQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : albums.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("web.gallery.empty")}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((a) => (
            <div
              key={a.id}
              className="group cursor-pointer overflow-hidden rounded-md border border-border bg-card transition hover:border-primary"
              onClick={() => setOpenAlbumId(a.id)}
            >
              {a.cover_image_url ? (
                <img src={a.cover_image_url} alt="" className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-40 w-full items-center justify-center bg-muted">
                  <Images className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="space-y-2 p-3">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">
                    {a.title_i18n?.[lang] || a.title_i18n?.pl || a.slug}
                  </p>
                  {a.is_public ? (
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
                </div>
                <div className="flex justify-end gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(a.id);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(a.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editingId) && (
        <AlbumEditorDialog
          orgId={orgId}
          albumId={editingId}
          onClose={() => {
            setCreating(false);
            setEditingId(null);
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["web-albums", orgId] });
            setCreating(false);
            setEditingId(null);
          }}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("web.gallery.delete_album_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("web.gallery.delete_album_desc")}</AlertDialogDescription>
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

// ---------------- Album editor ----------------

interface AlbumForm {
  slug: string;
  title: Record<Lang, string>;
  description: Record<Lang, string>;
  coverImageUrl: string;
  isPublic: boolean;
}

const emptyAlbum: AlbumForm = {
  slug: "",
  title: { pl: "", en: "" },
  description: { pl: "", en: "" },
  coverImageUrl: "",
  isPublic: false,
};

function AlbumEditorDialog({
  orgId,
  albumId,
  onClose,
  onSaved,
}: {
  orgId: string;
  albumId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const fetchItem = useServerFn(getWebAlbum);
  const saveFn = useServerFn(upsertWebAlbum);
  const [form, setForm] = useState<AlbumForm>(emptyAlbum);
  const [activeLang, setActiveLang] = useState<Lang>("pl");
  const [initialized, setInitialized] = useState(false);

  useQuery({
    queryKey: ["web-album-item", albumId],
    queryFn: async () => {
      if (!albumId) return null;
      const res = await fetchItem({ data: { id: albumId } });
      const a = res.album as Record<string, unknown>;
      const title = (a.title_i18n as Record<string, string>) ?? {};
      const desc = (a.description_i18n as Record<string, string>) ?? {};
      setForm({
        slug: String(a.slug ?? ""),
        title: { pl: title.pl ?? "", en: title.en ?? "" },
        description: { pl: desc.pl ?? "", en: desc.en ?? "" },
        coverImageUrl: String(a.cover_image_url ?? ""),
        isPublic: Boolean(a.is_public),
      });
      setInitialized(true);
      return res;
    },
    enabled: !!albumId,
    staleTime: 0,
  });

  if (!albumId && !initialized) {
    setForm(emptyAlbum);
    setInitialized(true);
  }

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: albumId ?? undefined,
          organizationId: orgId,
          slug: form.slug.trim() || undefined,
          titleI18n: { pl: form.title.pl, en: form.title.en },
          descriptionI18n: { pl: form.description.pl, en: form.description.en },
          coverImageUrl: form.coverImageUrl.trim() || null,
          isPublic: form.isPublic,
        },
      }),
    onSuccess: () => {
      toast.success(t("web.gallery.album_saved"));
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {albumId ? t("web.gallery.edit_album") : t("web.gallery.add_album")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("web.gallery.cover_url")}</Label>
              <Input
                value={form.coverImageUrl}
                onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>{t("web.news.slug")}</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder={t("web.news.slug_placeholder")}
              />
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
                  <Label>{t("web.gallery.description")} ({l.toUpperCase()})</Label>
                  <Textarea
                    rows={3}
                    value={form.description[l]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        description: { ...form.description, [l]: e.target.value },
                      })
                    }
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

// ---------------- Album detail (items management) ----------------

interface GalleryItem {
  id: string;
  kind: "image" | "video";
  url: string;
  url_thumb: string | null;
  caption_i18n: Record<string, string>;
  photo_credit: string | null;
  sort_order: number;
}

function AlbumDetail({
  orgId,
  albumId,
  onBack,
}: {
  orgId: string;
  albumId: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fetchItem = useServerFn(getWebAlbum);
  const upsertItemFn = useServerFn(upsertWebGalleryItem);
  const deleteItemFn = useServerFn(deleteWebGalleryItem);

  const albumQuery = useQuery({
    queryKey: ["web-album-detail", albumId],
    queryFn: () => fetchItem({ data: { id: albumId } }),
  });

  const [newKind, setNewKind] = useState<"image" | "video">("image");
  const [newUrl, setNewUrl] = useState("");
  const [newThumb, setNewThumb] = useState("");
  const [newCaption, setNewCaption] = useState("");
  const [newCredit, setNewCredit] = useState("");

  const addMut = useMutation({
    mutationFn: () => {
      if (!newUrl.trim()) throw new Error(t("web.gallery.item_url_required"));
      const items = (albumQuery.data?.items ?? []) as GalleryItem[];
      const nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
      return upsertItemFn({
        data: {
          albumId,
          organizationId: orgId,
          kind: newKind,
          url: newUrl.trim(),
          urlThumb: newThumb.trim() || null,
          captionI18n: newCaption.trim() ? { pl: newCaption.trim(), en: newCaption.trim() } : {},
          photoCredit: newCredit.trim() || null,
          sortOrder: nextOrder,
        },
      });
    },
    onSuccess: () => {
      toast.success(t("web.gallery.item_added"));
      setNewUrl("");
      setNewThumb("");
      setNewCaption("");
      setNewCredit("");
      qc.invalidateQueries({ queryKey: ["web-album-detail", albumId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteItemFn({ data: { id } }),
    onSuccess: () => {
      toast.success(t("web.gallery.item_deleted"));
      qc.invalidateQueries({ queryKey: ["web-album-detail", albumId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const album = albumQuery.data?.album as Record<string, unknown> | undefined;
  const items = (albumQuery.data?.items ?? []) as GalleryItem[];
  const titlePl = album ? ((album.title_i18n as Record<string, string>)?.pl ?? "") : "";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> {t("common.back")}
        </Button>
        <h2 className="text-lg font-semibold">{titlePl || t("web.gallery.album")}</h2>
      </div>

      <div className="rounded-md border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium">{t("web.gallery.add_item")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("web.gallery.kind")}</Label>
            <Select value={newKind} onValueChange={(v) => setNewKind(v as "image" | "video")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">{t("web.gallery.kind_image")}</SelectItem>
                <SelectItem value="video">{t("web.gallery.kind_video")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("web.gallery.item_url")}</Label>
            <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>{t("web.gallery.thumb_url")}</Label>
            <Input value={newThumb} onChange={(e) => setNewThumb(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>{t("web.gallery.credit")}</Label>
            <Input value={newCredit} onChange={(e) => setNewCredit(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t("web.gallery.caption")}</Label>
            <Input value={newCaption} onChange={(e) => setNewCaption(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={() => addMut.mutate()} disabled={addMut.isPending}>
            <Plus className="mr-2 h-4 w-4" /> {t("web.gallery.add_item")}
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("web.gallery.no_items")}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <div key={it.id} className="relative overflow-hidden rounded-md border border-border">
              {it.kind === "image" ? (
                <img src={it.url_thumb || it.url} alt="" className="h-32 w-full object-cover" />
              ) : (
                <div className="flex h-32 w-full items-center justify-center bg-muted">
                  <Video className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="p-2">
                <p className="truncate text-xs text-muted-foreground">{it.url}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-1 top-1 h-7 w-7 bg-background/80"
                onClick={() => delMut.mutate(it.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
