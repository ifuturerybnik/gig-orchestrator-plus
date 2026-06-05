import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Inbox,
  MessageSquare,
  Shield,
  Sparkles,
  Loader2,
  Send,
  EyeOff,
  Trash2,
  Archive,
  AlertTriangle,
  Wand2,
  Database,
  ExternalLink,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  listInboxComments,
  moderateComment,
  replyToComment,
  aiSuggestCommentReply,
  aiModerateComment,
  seedDemoInboxComments,
  getInboxCounts,
  type InboxCommentRow,
} from "@/lib/social.functions";
import { SOCIAL_PLATFORMS, type SocialPlatformId } from "@/lib/social-platforms";

type StatusFilter = "new" | "replied" | "hidden" | "spam" | "archived" | "all";

export function InboxTab({ orgId }: { orgId: string }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("new");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [variants, setVariants] = useState<string[] | null>(null);
  const [aiBusy, setAiBusy] = useState<"none" | "reply" | "moderate">("none");

  const listFn = useServerFn(listInboxComments);
  const countsFn = useServerFn(getInboxCounts);
  const moderateFn = useServerFn(moderateComment);
  const replyFn = useServerFn(replyToComment);
  const suggestFn = useServerFn(aiSuggestCommentReply);
  const aiModFn = useServerFn(aiModerateComment);
  const seedFn = useServerFn(seedDemoInboxComments);

  const listQ = useQuery({
    queryKey: ["inbox-comments", orgId, statusFilter],
    queryFn: () => listFn({ data: { organizationId: orgId, status: statusFilter } }),
  });
  const countsQ = useQuery({
    queryKey: ["inbox-counts", orgId],
    queryFn: () => countsFn({ data: { organizationId: orgId } }),
  });

  const items = listQ.data?.items ?? [];
  const selected = items.find((c) => c.id === selectedId) ?? items[0] ?? null;
  const counts = countsQ.data ?? { new: 0, replied: 0, hidden: 0, spam: 0, total: 0 };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["inbox-comments", orgId] });
    qc.invalidateQueries({ queryKey: ["inbox-counts", orgId] });
  };

  const handleSeed = async () => {
    try {
      const res = await seedFn({ data: { organizationId: orgId } });
      toast.success(t("social.inbox.toast.seeded", { count: res.inserted }));
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleAction = async (action: "hide" | "delete" | "mark_spam" | "archive") => {
    if (!selected) return;
    try {
      await moderateFn({ data: { organizationId: orgId, commentId: selected.id, action } });
      toast.success(t(`social.inbox.toast.${action}`));
      setVariants(null);
      setReplyText("");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleReply = async () => {
    if (!selected || !replyText.trim()) return;
    try {
      await replyFn({
        data: { organizationId: orgId, commentId: selected.id, text: replyText.trim() },
      });
      toast.success(t("social.inbox.toast.replied"));
      setReplyText("");
      setVariants(null);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSuggest = async (tone: "warm" | "formal" | "short") => {
    if (!selected) return;
    setAiBusy("reply");
    try {
      const res = await suggestFn({
        data: {
          organizationId: orgId,
          commentId: selected.id,
          tone,
          language: i18n.language === "en" ? "en" : "pl",
        },
      });
      setVariants(res.variants);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBusy("none");
    }
  };

  const handleModerate = async () => {
    if (!selected) return;
    setAiBusy("moderate");
    try {
      const res = await aiModFn({ data: { organizationId: orgId, commentId: selected.id } });
      toast.success(
        t("social.inbox.toast.ai_moderated", {
          sentiment: t(`social.inbox.sentiment.${res.sentiment}`),
        }),
      );
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBusy("none");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">{t("social.inbox.title")}</CardTitle>
              <Badge variant="secondary">
                {t("social.inbox.tura2_badge")}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleSeed}>
                <Database className="mr-2 h-3.5 w-3.5" />
                {t("social.inbox.seed_demo")}
              </Button>
            </div>
          </div>
          <CardDescription>{t("social.inbox.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <CountChip label={t("social.inbox.status.new")} count={counts.new ?? 0} active={statusFilter === "new"} onClick={() => setStatusFilter("new")} />
            <CountChip label={t("social.inbox.status.replied")} count={counts.replied ?? 0} active={statusFilter === "replied"} onClick={() => setStatusFilter("replied")} />
            <CountChip label={t("social.inbox.status.hidden")} count={counts.hidden ?? 0} active={statusFilter === "hidden"} onClick={() => setStatusFilter("hidden")} />
            <CountChip label={t("social.inbox.status.spam")} count={counts.spam ?? 0} active={statusFilter === "spam"} onClick={() => setStatusFilter("spam")} />
            <CountChip label={t("social.inbox.status.archived")} count={counts.archived ?? 0} active={statusFilter === "archived"} onClick={() => setStatusFilter("archived")} />
            <CountChip label={t("social.inbox.status.all")} count={counts.total ?? 0} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {listQ.isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
                <Inbox className="h-8 w-8 opacity-30" />
                <p>{t("social.inbox.empty_state")}</p>
                <Button size="sm" variant="outline" onClick={handleSeed}>
                  <Database className="mr-2 h-3.5 w-3.5" />
                  {t("social.inbox.seed_demo")}
                </Button>
              </div>
            ) : (
              <ul className="divide-y max-h-[60vh] overflow-y-auto">
                {items.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(c.id);
                        setVariants(null);
                        setReplyText("");
                      }}
                      className={`flex w-full flex-col items-start gap-1 px-3 py-2.5 text-left transition hover:bg-muted/50 ${
                        selected?.id === c.id ? "bg-muted/70" : ""
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {c.author_name ?? t("social.inbox.unknown_author")}
                        </span>
                        <PlatformBadge platform={c.platform as SocialPlatformId} />
                      </div>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{c.content}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {c.posted_at && <span>{new Date(c.posted_at).toLocaleString()}</span>}
                        {c.ai_sentiment && (
                          <span className={sentimentClass(c.ai_sentiment)}>
                            • {t(`social.inbox.sentiment.${c.ai_sentiment}`)}
                          </span>
                        )}
                        {c.ai_flags?.includes("spam") && (
                          <Badge variant="destructive" className="px-1 py-0 text-[9px]">SPAM</Badge>
                        )}
                        {c.ai_flags?.includes("hate") && (
                          <Badge variant="destructive" className="px-1 py-0 text-[9px]">HATE</Badge>
                        )}
                        {c.ai_flags?.includes("urgent_question") && (
                          <Badge className="bg-amber-500 px-1 py-0 text-[9px]">!</Badge>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          {selected ? (
            <InboxDetail
              comment={selected}
              orgId={orgId}
              replyText={replyText}
              setReplyText={setReplyText}
              variants={variants}
              setVariants={setVariants}
              aiBusy={aiBusy}
              onAction={handleAction}
              onReply={handleReply}
              onSuggest={handleSuggest}
              onModerate={handleModerate}
            />
          ) : (
            <CardContent className="flex h-72 items-center justify-center text-sm text-muted-foreground">
              {t("social.inbox.select_hint")}
            </CardContent>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("social.inbox.platform_support_title")}</CardTitle>
          <CardDescription>{t("social.inbox.platform_support_subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">{t("social.inbox.table.platform")}</th>
                  <th className="py-2 pr-3">{t("social.inbox.table.read")}</th>
                  <th className="py-2 pr-3">{t("social.inbox.table.reply")}</th>
                  <th className="py-2 pr-3">{t("social.inbox.table.hide")}</th>
                  <th className="py-2 pr-3">{t("social.inbox.table.delete")}</th>
                  <th className="py-2 pr-3">{t("social.inbox.table.dm")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ["Facebook Pages", "yes", "yes", "yes", "yes", "yes"],
                  ["Instagram Business", "yes", "yes", "yes", "yes", "yes"],
                  ["LinkedIn Company", "yes", "yes", "partial", "no", "no"],
                  ["YouTube", "yes", "yes", "yes", "yes", "no"],
                  ["X / Twitter", "yes", "yes", "partial", "no", "no"],
                  ["TikTok", "yes", "yes", "yes", "yes", "no"],
                  ["Spotify for Artists", "no", "no", "no", "no", "no"],
                ].map(([platform, ...cells]) => (
                  <tr key={platform}>
                    <td className="py-2 pr-3 font-medium">{platform}</td>
                    {cells.map((v, i) => (
                      <td key={i} className="py-2 pr-3">
                        <span
                          className={
                            v === "yes"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : v === "partial"
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground"
                          }
                        >
                          {t(`social.inbox.support.${v}`)}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CountChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
        active ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted/50"
      }`}
    >
      <span>{label}</span>
      <span className={`rounded-full px-1.5 text-[10px] font-semibold ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
        {count}
      </span>
    </button>
  );
}

function PlatformBadge({ platform }: { platform: SocialPlatformId }) {
  const meta = SOCIAL_PLATFORMS[platform];
  if (!meta) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white ${meta.brandColor}`}
    >
      {platform}
    </span>
  );
}

function sentimentClass(s: string) {
  if (s === "positive") return "text-emerald-600 dark:text-emerald-400";
  if (s === "negative") return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

function InboxDetail({
  comment,
  orgId: _orgId,
  replyText,
  setReplyText,
  variants,
  setVariants,
  aiBusy,
  onAction,
  onReply,
  onSuggest,
  onModerate,
}: {
  comment: InboxCommentRow;
  orgId: string;
  replyText: string;
  setReplyText: (v: string) => void;
  variants: string[] | null;
  setVariants: (v: string[] | null) => void;
  aiBusy: "none" | "reply" | "moderate";
  onAction: (a: "hide" | "delete" | "mark_spam" | "archive") => void;
  onReply: () => void;
  onSuggest: (tone: "warm" | "formal" | "short") => void;
  onModerate: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">
              {comment.author_name ?? t("social.inbox.unknown_author")}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <PlatformBadge platform={comment.platform as SocialPlatformId} />
              {comment.posted_at && (
                <span className="text-xs">{new Date(comment.posted_at).toLocaleString()}</span>
              )}
              {comment.permalink && (
                <a
                  href={comment.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {t("social.inbox.open_original")} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </CardDescription>
          </div>
          <Badge variant="outline" className="capitalize">
            {t(`social.inbox.status.${comment.status}`)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/30 p-3 text-sm">{comment.content}</div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={onModerate} disabled={aiBusy !== "none"}>
            {aiBusy === "moderate" ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Shield className="mr-2 h-3.5 w-3.5" />
            )}
            {t("social.inbox.actions.ai_moderate")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAction("hide")}>
            <EyeOff className="mr-2 h-3.5 w-3.5" />
            {t("social.inbox.actions.hide")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAction("mark_spam")}>
            <AlertTriangle className="mr-2 h-3.5 w-3.5" />
            {t("social.inbox.actions.spam")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAction("archive")}>
            <Archive className="mr-2 h-3.5 w-3.5" />
            {t("social.inbox.actions.archive")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAction("delete")}>
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            {t("social.inbox.actions.delete")}
          </Button>
        </div>

        {comment.ai_sentiment && (
          <div className="flex items-center gap-2 rounded-md border border-dashed bg-card/50 p-2 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>
              {t("social.inbox.ai_panel.sentiment")}:{" "}
              <strong className={sentimentClass(comment.ai_sentiment)}>
                {t(`social.inbox.sentiment.${comment.ai_sentiment}`)}
              </strong>
            </span>
            {comment.ai_flags?.length > 0 && (
              <span className="flex items-center gap-1">
                {t("social.inbox.ai_panel.flags")}:
                {comment.ai_flags.map((f) => (
                  <Badge key={f} variant="secondary" className="text-[10px]">
                    {f}
                  </Badge>
                ))}
              </span>
            )}
          </div>
        )}

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="h-4 w-4 text-primary" />
              {t("social.inbox.reply.title")}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">{t("social.inbox.reply.ai_tone")}:</span>
              <Select onValueChange={(v) => onSuggest(v as "warm" | "formal" | "short")}>
                <SelectTrigger className="h-7 w-[140px] text-xs">
                  <SelectValue placeholder={t("social.inbox.reply.suggest")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warm">{t("social.inbox.tones.warm")}</SelectItem>
                  <SelectItem value="formal">{t("social.inbox.tones.formal")}</SelectItem>
                  <SelectItem value="short">{t("social.inbox.tones.short")}</SelectItem>
                </SelectContent>
              </Select>
              {aiBusy === "reply" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </div>
          </div>

          {variants && variants.length > 0 && (
            <div className="space-y-2 rounded-md border border-dashed bg-primary/5 p-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Wand2 className="h-3 w-3" />
                {t("social.inbox.reply.ai_variants")}
              </div>
              <ul className="space-y-1.5">
                {variants.map((v, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyText(v);
                        setVariants(null);
                      }}
                      className="block w-full rounded border bg-background p-2 text-left text-sm hover:border-primary"
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
            <p className="text-xs text-muted-foreground">{t("social.inbox.reply.pending_oauth_note")}</p>
            <Button size="sm" onClick={onReply} disabled={!replyText.trim()}>
              <Send className="mr-2 h-3.5 w-3.5" />
              {t("social.inbox.reply.send")}
            </Button>
          </div>
        </div>
      </CardContent>
    </>
  );
}
