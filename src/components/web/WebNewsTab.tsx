import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { WebTabInstructions } from "@/components/web/WebTabInstructions";

import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Globe, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { WysiwygEditor } from "@/components/ui/wysiwyg-editor";
import {
  listWebNews,
  getWebNewsItem,
  upsertWebNews,
  deleteWebNews,
} from "@/lib/web.functions";

type Lang = "pl" | "en";

interface NewsListItem {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  excerpt_i18n: Record<string, string>;
  cover_image_url: string | null;
  is_public: boolean;
  published_at: string | null;
  updated_at: string;
  tags: string[];
}

export function WebNewsTab({ orgId }: { orgId: string }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const fetchList = useServerFn(listWebNews);

  const listQuery = useQuery({
    queryKey: ["web-news", orgId],
    queryFn: () => fetchList({ data: { organizationId: orgId } }),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteFn = useServerFn(deleteWebNews);
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success(t("web.news.deleted"));
      qc.invalidateQueries({ queryKey: ["web-news", orgId] });
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lang = (i18n.language?.startsWith("en") ? "en" : "pl") as Lang;
  const items = (listQuery.data?.news ?? []) as NewsListItem[];

  return (
    <div className="space-y-4">
      <WebTabInstructions tab="news" />
      <div className="flex items-center justify-between">

        <div>
          <h2 className="text-lg font-semibold">{t("web.news.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("web.news.subtitle")}</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" /> {t("web.news.add")}
        </Button>
      </div>

      {listQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("web.news.empty")}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div
              key={it.id}
              className="flex items-center gap-3 rounded-md border border-border bg-card p-3"
            >
              {it.cover_image_url ? (
                <img
                  src={it.cover_image_url}
                  alt=""
                  className="h-14 w-20 shrink-0 rounded object-cover"
                />
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
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  /{it.slug}
                  {it.published_at && ` · ${new Date(it.published_at).toLocaleDateString()}`}
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
        <NewsEditorDialog
          orgId={orgId}
          newsId={editingId}
          onClose={() => {
            setCreating(false);
            setEditingId(null);
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["web-news", orgId] });
            setCreating(false);
            setEditingId(null);
          }}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("web.news.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("web.news.delete_desc")}</AlertDialogDescription>
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

// ---------------- Editor dialog ----------------

interface NewsForm {
  slug: string;
  title: Record<Lang, string>;
  excerpt: Record<Lang, string>;
  content: Record<Lang, string>;
  coverImageUrl: string;
  tagsCsv: string;
  authorName: string;
  isPublic: boolean;
}

const emptyForm: NewsForm = {
  slug: "",
  title: { pl: "", en: "" },
  excerpt: { pl: "", en: "" },
  content: { pl: "", en: "" },
  coverImageUrl: "",
  tagsCsv: "",
  authorName: "",
  isPublic: false,
};

function NewsEditorDialog({
  orgId,
  newsId,
  onClose,
  onSaved,
}: {
  orgId: string;
  newsId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const fetchItem = useServerFn(getWebNewsItem);
  const saveFn = useServerFn(upsertWebNews);
  const [form, setForm] = useState<NewsForm>(emptyForm);
  const [activeLang, setActiveLang] = useState<Lang>("pl");
  const [initialized, setInitialized] = useState(false);

  useQuery({
    queryKey: ["web-news-item", newsId],
    queryFn: async () => {
      if (!newsId) return null;
      const res = await fetchItem({ data: { id: newsId } });
      const it = res.item as Record<string, unknown>;
      const title = (it.title_i18n as Record<string, string>) ?? {};
      const excerpt = (it.excerpt_i18n as Record<string, string>) ?? {};
      const content = (it.content_html_i18n as Record<string, string>) ?? {};
      setForm({
        slug: String(it.slug ?? ""),
        title: { pl: title.pl ?? "", en: title.en ?? "" },
        excerpt: { pl: excerpt.pl ?? "", en: excerpt.en ?? "" },
        content: { pl: content.pl ?? "", en: content.en ?? "" },
        coverImageUrl: String(it.cover_image_url ?? ""),
        tagsCsv: Array.isArray(it.tags) ? (it.tags as string[]).join(", ") : "",
        authorName: String(it.author_name ?? ""),
        isPublic: Boolean(it.is_public),
      });
      setInitialized(true);
      return res;
    },
    enabled: !!newsId,
    staleTime: 0,
  });

  // For "creating", initialize empty form
  if (!newsId && !initialized) {
    setForm(emptyForm);
    setInitialized(true);
  }

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: newsId ?? undefined,
          organizationId: orgId,
          slug: form.slug.trim() || undefined,
          titleI18n: { pl: form.title.pl, en: form.title.en },
          excerptI18n: { pl: form.excerpt.pl, en: form.excerpt.en },
          contentHtmlI18n: { pl: form.content.pl, en: form.content.en },
          coverImageUrl: form.coverImageUrl.trim() || null,
          galleryImageUrls: [],
          tags: form.tagsCsv
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          authorName: form.authorName.trim() || null,
          isPublic: form.isPublic,
        },
      }),
    onSuccess: () => {
      toast.success(t("web.news.saved"));
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {newsId ? t("web.news.edit") : t("web.news.add")}
          </DialogTitle>
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
              <Label>{t("web.news.slug")}</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder={t("web.news.slug_placeholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("web.news.author")}</Label>
              <Input
                value={form.authorName}
                onChange={(e) => setForm({ ...form, authorName: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("web.news.tags")}</Label>
              <Input
                value={form.tagsCsv}
                onChange={(e) => setForm({ ...form, tagsCsv: e.target.value })}
                placeholder={t("web.news.tags_placeholder")}
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
                  <Label>{t("web.news.excerpt")} ({l.toUpperCase()})</Label>
                  <Textarea
                    rows={3}
                    maxLength={500}
                    value={form.excerpt[l]}
                    onChange={(e) =>
                      setForm({ ...form, excerpt: { ...form.excerpt, [l]: e.target.value } })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("web.news.content")} ({l.toUpperCase()})</Label>
                  <WysiwygEditor
                    value={form.content[l]}
                    onChange={(html) =>
                      setForm({ ...form, content: { ...form.content, [l]: html } })
                    }
                    minHeight="300px"
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
