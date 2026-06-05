import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CalendarClock,
  ExternalLink,
  Eye,
  Heart,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Share2,
  Sparkles,
  Shield,
  EyeOff,
  AlertTriangle,
  Trash2,
  Archive,
  Wand2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getSocialPostDetails,
  syncPostNow,
  replyToComment,
  moderateComment,
  aiSuggestCommentReply,
  type InboxCommentRow,
} from "@/lib/social.functions";
import { SOCIAL_PLATFORMS, type SocialPlatformId } from "@/lib/social-platforms";

export function PostDetailsDialog({
  orgId,
  postId,
  open,
  onOpenChange,
}: {
  orgId: string;
  postId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const fetchDetails = useServerFn(getSocialPostDetails);
  const syncFn = useServerFn(syncPostNow);
  const replyFn = useServerFn(replyToComment);
  const moderateFn = useServerFn(moderateComment);
  const suggestFn = useServerFn(aiSuggestCommentReply);

  const detailsQ = useQuery({
    queryKey: ["social-post-details", orgId, postId],
    queryFn: () => fetchDetails({ data: { organizationId: orgId, postId: postId! } }),
    enabled: open && !!postId,
  });

  const post = detailsQ.data?.post ?? null;
  const metricsByPlatform = detailsQ.data?.metricsByPlatform ?? [];
  const comments = detailsQ.data?.comments ?? [];

  const firstContent = post ? Object.values(post.content_per_platform)[0] : null;
  const text = firstContent?.text ?? "";
  const media = firstContent?.media_urls ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["social-post-details", orgId, postId] });
    qc.invalidateQueries({ queryKey: ["social-posts", orgId] });
    qc.invalidateQueries({ queryKey: ["inbox-comments", orgId] });
    qc.invalidateQueries({ queryKey: ["inbox-counts", orgId] });
  };

  const [syncing, setSyncing] = useState(false);
  const handleSync = async () => {
    if (!postId) return;
    setSyncing(true);
    try {
      const res = await syncFn({ data: { organizationId: orgId, postId } });
      const metaLimited = res.errors.filter((m) => m.includes("Meta nie udostępnia"));
      if (metaLimited.length) toast.info(t("social.schedule.sync_meta_limited"));
      else toast.success(t("social.schedule.sync_done", { metrics: res.metricsOk, comments: res.commentsInserted }));
      const others = res.errors.filter((m) => !m.includes("Meta nie udostępnia"));
      if (others.length) toast.warning(others.join("; "));
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("social.post_details.title")}</DialogTitle>
          <DialogDescription>{t("social.post_details.subtitle")}</DialogDescription>
        </DialogHeader>

        {detailsQ.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !post ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {t("social.post_details.not_found")}
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
            <div className="space-y-4 pb-2">
              {/* Header: platforms + status + sync */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  {post.target_platforms.map((pid) => (
                    <Badge key={pid} variant="outline">
                      {SOCIAL_PLATFORMS[pid as SocialPlatformId]
                        ? t(`social.platforms.${pid as SocialPlatformId}.name`)
                        : pid}
                    </Badge>
                  ))}
                  <Badge
                    variant={
                      post.status === "published"
                        ? "default"
                        : post.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {t(`social.post_status.${post.status}`)}
                  </Badge>
                  {post.published_at && (
                    <span className="ml-2 text-xs text-muted-foreground inline-flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      {new Date(post.published_at).toLocaleString()}
                    </span>
                  )}
                </div>
                {post.status === "published" && (
                  <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
                    {syncing ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    )}
                    {t("social.schedule.sync_now")}
                  </Button>
                )}
              </div>

              {/* Media gallery */}
              {media.length > 0 && (
                <div className={`grid gap-2 ${media.length === 1 ? "grid-cols-1" : "grid-cols-2 md:grid-cols-3"}`}>
                  {media.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt=""
                      loading="lazy"
                      className="w-full rounded-md object-cover max-h-80"
                    />
                  ))}
                </div>
              )}

              {/* Text */}
              {text && (
                <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">
                  {text}
                </div>
              )}

              {/* Per-platform results + metrics */}
              <div className="space-y-2">
                {post.results.length === 0 && (
                  <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    {t("social.post_details.no_results")}
                  </div>
                )}
                {post.results.map((r) => {
                  const m = metricsByPlatform.find((x) => x.platform === r.platform);
                  return (
                    <div
                      key={r.platform}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {SOCIAL_PLATFORMS[r.platform as SocialPlatformId]
                            ? t(`social.platforms.${r.platform as SocialPlatformId}.name`)
                            : r.platform}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{r.status}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <Metric icon={<Heart className="h-3 w-3" />} value={m?.likes ?? 0} />
                        <Metric icon={<MessageCircle className="h-3 w-3" />} value={m?.comments ?? 0} />
                        <Metric icon={<Share2 className="h-3 w-3" />} value={m?.shares ?? 0} />
                        {(m?.views ?? 0) > 0 && <Metric icon={<Eye className="h-3 w-3" />} value={m?.views ?? 0} />}
                        {r.external_url && (
                          <a
                            href={r.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            {t("social.schedule.open_original")}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator />

              {/* Comments */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium inline-flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    {t("social.post_details.comments_title", { count: comments.length })}
                  </div>
                </div>

                {comments.length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                    {t("social.post_details.no_comments")}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {comments.map((c) => (
                      <CommentItem
                        key={c.id}
                        comment={c}
                        orgId={orgId}
                        replyFn={replyFn}
                        moderateFn={moderateFn}
                        suggestFn={suggestFn}
                        onChanged={invalidate}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
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

function CommentItem({
  comment,
  orgId,
  replyFn,
  moderateFn,
  suggestFn,
  onChanged,
}: {
  comment: InboxCommentRow;
  orgId: string;
  replyFn: (args: { data: { organizationId: string; commentId: string; text: string } }) => Promise<{ ok: boolean; sent: boolean; error: string | null }>;
  moderateFn: (args: { data: { organizationId: string; commentId: string; action: "hide" | "unhide" | "delete" | "mark_spam" | "archive" } }) => Promise<{ ok: boolean }>;
  suggestFn: (args: { data: { organizationId: string; commentId: string; tone: "warm" | "formal" | "short"; language: "pl" | "en" } }) => Promise<{ variants: string[] }>;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState<"none" | "reply" | "suggest" | "moderate">("none");
  const [variants, setVariants] = useState<string[] | null>(null);

  useEffect(() => {
    if (!replyOpen) {
      setReplyText("");
      setVariants(null);
    }
  }, [replyOpen]);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setBusy("reply");
    try {
      const res = await replyFn({
        data: { organizationId: orgId, commentId: comment.id, text: replyText.trim() },
      });
      if (res.sent) toast.success(t("social.inbox.toast.replied"));
      else if (res.error) toast.info(res.error);
      else toast.success(t("social.inbox.toast.replied"));
      setReplyOpen(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("none");
    }
  };

  const handleSuggest = async (tone: "warm" | "formal" | "short") => {
    setBusy("suggest");
    try {
      const res = await suggestFn({
        data: { organizationId: orgId, commentId: comment.id, tone, language: "pl" },
      });
      setVariants(res.variants);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("none");
    }
  };

  const handleModerate = async (action: "hide" | "delete" | "mark_spam" | "archive") => {
    setBusy("moderate");
    try {
      await moderateFn({ data: { organizationId: orgId, commentId: comment.id, action } });
      toast.success(t(`social.inbox.toast.${action}`));
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("none");
    }
  };

  return (
    <li className="rounded-md border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {comment.author_avatar_url && (
              <img
                src={comment.author_avatar_url}
                alt=""
                className="h-6 w-6 rounded-full object-cover"
              />
            )}
            <span className="font-medium">
              {comment.author_name ?? t("social.inbox.unknown_author")}
            </span>
            {comment.posted_at && (
              <span className="text-xs text-muted-foreground">
                {new Date(comment.posted_at).toLocaleString()}
              </span>
            )}
            <Badge variant="outline" className="text-[10px]">
              {t(`social.inbox.status.${comment.status}`)}
            </Badge>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{comment.content}</p>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {comment.like_count}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              {comment.reply_count}
            </span>
            {comment.permalink && (
              <a
                href={comment.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {t("social.inbox.open_original")} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-none flex-col items-end gap-1">
          <Button
            size="sm"
            variant={replyOpen ? "secondary" : "outline"}
            onClick={() => setReplyOpen((v) => !v)}
          >
            <Send className="mr-1 h-3 w-3" />
            {t("social.post_details.reply")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleModerate("delete")}
            disabled={busy !== "none"}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            {t("social.inbox.actions.delete")}
          </Button>
        </div>
      </div>

      {replyOpen && (
        <div className="mt-3 space-y-2 rounded-md border bg-muted/20 p-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium inline-flex items-center gap-1">
              <Shield className="h-3 w-3" /> {t("social.post_details.moderation")}
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => handleModerate("hide")} disabled={busy !== "none"}>
                <EyeOff className="mr-1 h-3 w-3" /> {t("social.inbox.actions.hide")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleModerate("mark_spam")} disabled={busy !== "none"}>
                <AlertTriangle className="mr-1 h-3 w-3" /> {t("social.inbox.actions.spam")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleModerate("archive")} disabled={busy !== "none"}>
                <Archive className="mr-1 h-3 w-3" /> {t("social.inbox.actions.archive")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleModerate("delete")} disabled={busy !== "none"}>
                <Trash2 className="mr-1 h-3 w-3" /> {t("social.inbox.actions.delete")}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              {t("social.inbox.reply.ai_tone")}:
            </div>
            <Select onValueChange={(v) => handleSuggest(v as "warm" | "formal" | "short")}>
              <SelectTrigger className="h-7 w-[140px] text-xs">
                <SelectValue placeholder={t("social.inbox.reply.suggest")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="warm">{t("social.inbox.tones.warm")}</SelectItem>
                <SelectItem value="formal">{t("social.inbox.tones.formal")}</SelectItem>
                <SelectItem value="short">{t("social.inbox.tones.short")}</SelectItem>
              </SelectContent>
            </Select>
            {busy === "suggest" && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>

          {variants && variants.length > 0 && (
            <div className="space-y-1 rounded-md border border-dashed bg-primary/5 p-2">
              <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Wand2 className="h-3 w-3" /> {t("social.inbox.reply.ai_variants")}
              </div>
              <ul className="space-y-1">
                {variants.map((v, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyText(v);
                        setVariants(null);
                      }}
                      className="block w-full rounded border bg-background p-2 text-left text-xs hover:border-primary"
                    >
                      {v}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={t("social.inbox.reply.placeholder")}
            rows={3}
            maxLength={4000}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {t("social.inbox.reply.pending_oauth_note")}
            </p>
            <Button size="sm" onClick={handleReply} disabled={!replyText.trim() || busy !== "none"}>
              {busy === "reply" ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <Send className="mr-2 h-3 w-3" />
              )}
              {t("social.inbox.reply.send")}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
