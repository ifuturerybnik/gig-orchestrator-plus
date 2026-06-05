import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CalendarClock,
  FileText,
  Sparkles,
  Send,
  ExternalLink,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  RefreshCw,
  Download,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  deleteImportedSocialPosts,
  deleteSocialPost,
  listSocialPosts,
  publishPostNow,
  syncPostNow,
} from "@/lib/social.functions";
import { SOCIAL_PLATFORMS, type SocialPlatformId } from "@/lib/social-platforms";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function ScheduleTab({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fetchPosts = useServerFn(listSocialPosts);
  const publishFn = useServerFn(publishPostNow);
  const syncFn = useServerFn(syncPostNow);
  const deletePostFn = useServerFn(deleteSocialPost);
  const deleteImportedFn = useServerFn(deleteImportedSocialPosts);
  const postsQ = useQuery({
    queryKey: ["social-posts", orgId],
    queryFn: () => fetchPosts({ data: { organizationId: orgId } }),
  });

  const items = postsQ.data?.items ?? [];
  const importedCount = items.filter((p) => p.source === "imported").length;
  const scheduledDays = items
    .filter((p) => p.scheduled_at)
    .map((p) => new Date(p.scheduled_at!));

  const handlePublishNow = async (postId: string) => {
    try {
      const res = await publishFn({ data: { organizationId: orgId, postId } });
      const summary = Object.entries(res.results)
        .map(([p, s]) => `${p}: ${s}`)
        .join(", ");
      toast.info(t("social.schedule.publish_now_result", { summary }));
      qc.invalidateQueries({ queryKey: ["social-posts", orgId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const invalidateSocialData = () => {
    qc.invalidateQueries({ queryKey: ["social-posts", orgId] });
    qc.invalidateQueries({ queryKey: ["inbox-comments", orgId] });
    qc.invalidateQueries({ queryKey: ["inbox-counts", orgId] });
  };

  const handleDeleteLocalPost = async (postId: string) => {
    try {
      await deletePostFn({ data: { organizationId: orgId, postId } });
      toast.success(t("social.schedule.local_delete_done"));
      invalidateSocialData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDeleteImported = async () => {
    try {
      const res = await deleteImportedFn({ data: { organizationId: orgId } });
      toast.success(t("social.schedule.import_delete_done", { count: res.deleted }));
      invalidateSocialData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSync = async (postId: string) => {
    try {
      const res = await syncFn({ data: { organizationId: orgId, postId } });
      const metaLimitedErrors = res.errors.filter((msg) =>
        msg.includes("Meta nie udostępnia jeszcze metryk/komentarzy"),
      );
      const otherErrors = res.errors.filter((msg) =>
        !msg.includes("Meta nie udostępnia jeszcze metryk/komentarzy"),
      );
      if (metaLimitedErrors.length) {
        toast.info(t("social.schedule.sync_meta_limited"));
      } else {
        toast.success(
          t("social.schedule.sync_done", {
            metrics: res.metricsOk,
            comments: res.commentsInserted,
          }),
        );
      }
      if (otherErrors.length) {
        toast.warning(otherErrors.join("; "));
      }
      qc.invalidateQueries({ queryKey: ["social-posts", orgId] });
      qc.invalidateQueries({ queryKey: ["inbox-comments", orgId] });
      qc.invalidateQueries({ queryKey: ["inbox-counts", orgId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_460px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-primary" />
              {t("social.schedule.calendar_title")}
            </CardTitle>
            <CardDescription>{t("social.schedule.cron_info")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="multiple"
              selected={scheduledDays}
              modifiers={{ scheduled: scheduledDays }}
              modifiersClassNames={{
                scheduled:
                  "after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
              }}
              className="w-full"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{t("social.schedule.list_title")}</CardTitle>
              <CardDescription>{t("social.schedule.list_subtitle")}</CardDescription>
            </div>
            {importedCount > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-2">
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("social.schedule.delete_imported")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("social.schedule.delete_imported_title")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("social.schedule.delete_imported_desc", { count: importedCount })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteImported}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t("social.schedule.delete_imported_confirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <FileText className="h-8 w-8 opacity-30" />
              <p>{t("social.schedule.empty")}</p>
            </div>
          ) : (
            items.map((p) => {
              const firstContent = Object.values(p.content_per_platform)[0];
              const text = firstContent?.text ?? "—";
              const media = firstContent?.media_urls ?? [];
              const cover = media[0];
              const result = p.results[0] ?? null;
              const externalUrl = result?.external_url ?? null;
              const isImported = p.source === "imported";
              const isPublished = p.status === "published";

              return (
                <div key={p.id} className="overflow-hidden rounded-md border text-sm">
                  <div className="flex gap-3 p-3">
                    {cover ? (
                      <img
                        src={cover}
                        alt=""
                        loading="lazy"
                        className="h-20 w-20 flex-none rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 flex-none items-center justify-center rounded bg-muted text-muted-foreground">
                        <ImageIcon className="h-6 w-6 opacity-40" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1">
                          {p.target_platforms.map((pid) => {
                            const meta = SOCIAL_PLATFORMS[pid as SocialPlatformId];
                            return (
                              <Badge key={pid} variant="outline" className="text-xs">
                                {meta ? t(`social.platforms.${pid as SocialPlatformId}.name`) : pid}
                              </Badge>
                            );
                          })}
                          {isImported && (
                            <Badge variant="secondary" className="gap-1 text-[10px]">
                              <Download className="h-3 w-3" />
                              {t("social.schedule.source_imported")}
                            </Badge>
                          )}
                          {p.ai_generated && (
                            <Badge variant="secondary" className="gap-1 text-[10px]">
                              <Sparkles className="h-3 w-3 text-primary" /> AI
                            </Badge>
                          )}
                        </div>
                        <Badge
                          variant={
                            p.status === "published"
                              ? "default"
                              : p.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                          className="text-xs"
                        >
                          {t(`social.post_status.${p.status}`)}
                        </Badge>
                      </div>

                      <div className="line-clamp-3 whitespace-pre-wrap text-muted-foreground">
                        {text}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {p.published_at ? (
                          <span>
                            <CalendarClock className="mr-1 inline h-3 w-3" />
                            {new Date(p.published_at).toLocaleString()}
                          </span>
                        ) : p.scheduled_at ? (
                          <span>
                            <CalendarClock className="mr-1 inline h-3 w-3" />
                            {new Date(p.scheduled_at).toLocaleString()}
                          </span>
                        ) : null}
                        {media.length > 1 && (
                          <span>
                            <ImageIcon className="mr-1 inline h-3 w-3" />
                            {media.length}
                          </span>
                        )}
                        {externalUrl && (
                          <a
                            href={externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            {t("social.schedule.open_original")}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>

                      {isPublished && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <Metric icon={<Heart className="h-3 w-3" />} value={p.metrics?.likes ?? 0} />
                          <Metric icon={<MessageCircle className="h-3 w-3" />} value={p.metrics?.comments ?? p.comment_counts.total} />
                          <Metric icon={<Share2 className="h-3 w-3" />} value={p.metrics?.shares ?? 0} />
                          {(p.metrics?.views ?? 0) > 0 && (
                            <Metric icon={<Eye className="h-3 w-3" />} value={p.metrics?.views ?? 0} />
                          )}
                          {p.comment_counts.new > 0 && (
                            <Badge variant="default" className="h-5 px-1.5 text-[10px]">
                              {t("social.schedule.new_comments", { count: p.comment_counts.new })}
                            </Badge>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-end gap-1 pt-1">
                        {isPublished && (
                          <Button size="sm" variant="ghost" onClick={() => handleSync(p.id)}>
                            <RefreshCw className="mr-1 h-3 w-3" />
                            {t("social.schedule.sync_now")}
                          </Button>
                        )}
                        {isImported && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <Trash2 className="mr-1 h-3 w-3" />
                                {t("social.schedule.delete_local")}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("social.schedule.delete_local_title")}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("social.schedule.delete_local_desc")}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteLocalPost(p.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {t("social.schedule.delete_local_confirm")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {(p.status === "scheduled" || p.status === "draft") && (
                          <Button size="sm" variant="ghost" onClick={() => handlePublishNow(p.id)}>
                            <Send className="mr-1 h-3 w-3" />
                            {t("social.schedule.publish_now")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      {icon}
      <span className="tabular-nums">{value}</span>
    </span>
  );
}
