import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Sparkles,
  Loader2,
  Save,
  ArrowRight,
  Wand2,
  CheckSquare,
  Square,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  SOCIAL_PLATFORM_ORDER,
  SOCIAL_PLATFORMS,
  type SocialPlatformId,
} from "@/lib/social-platforms";
import { aiGenerateSocialPost, createSocialPost } from "@/lib/social.functions";
import { listPerformances } from "@/lib/performances.functions";

type GeneratedContent = Record<string, { text: string; hashtags: string[] }>;

export function AiStudioTab({ orgId }: { orgId: string }) {
  const { t, i18n } = useTranslation();
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatformId[]>([
    "facebook",
    "instagram",
  ]);
  const [eventId, setEventId] = useState<string>("none");
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState<"informational" | "promotional" | "celebratory" | "behind_the_scenes">("promotional");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<GeneratedContent | null>(null);
  const [bestTime, setBestTime] = useState<string | null>(null);
  const [editedPlatform, setEditedPlatform] = useState<SocialPlatformId | null>(null);

  const fetchEvents = useServerFn(listPerformances);
  const eventsQ = useQuery({
    queryKey: ["performances", orgId],
    queryFn: () => fetchEvents({ data: { organizationId: orgId } }),
  });

  const generateFn = useServerFn(aiGenerateSocialPost);
  const saveFn = useServerFn(createSocialPost);

  const togglePlatform = (pid: SocialPlatformId) => {
    setSelectedPlatforms((prev) =>
      prev.includes(pid) ? prev.filter((p) => p !== pid) : [...prev, pid],
    );
  };

  const handleGenerate = async () => {
    if (selectedPlatforms.length === 0) {
      toast.error(t("social.ai.errors.no_platforms"));
      return;
    }
    setLoading(true);
    try {
      const result = await generateFn({
        data: {
          organizationId: orgId,
          platforms: selectedPlatforms,
          eventId: eventId !== "none" ? eventId : null,
          prompt: prompt.trim() || undefined,
          tone,
          language: i18n.language === "en" ? "en" : "pl",
        },
      });
      setGenerated(result.perPlatform);
      setBestTime(result.bestTimeHint);
      toast.success(t("social.ai.toast.generated"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsDraft = async () => {
    if (!generated) return;
    const contentPerPlatform: Record<string, { text: string; hashtags: string[] }> = {};
    for (const pid of selectedPlatforms) {
      const c = generated[pid];
      if (c) contentPerPlatform[pid] = c;
    }
    try {
      await saveFn({
        data: {
          organizationId: orgId,
          targetPlatforms: selectedPlatforms,
          contentPerPlatform,
          linkedEventId: eventId !== "none" ? eventId : null,
          status: "draft",
          aiGenerated: true,
          aiScenariusz: eventId !== "none" ? "social_post_from_event" : "social_post_from_prompt",
        },
      });
      toast.success(t("social.ai.toast.saved_draft"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-4 w-4 text-primary" />
            {t("social.ai.form.title")}
          </CardTitle>
          <CardDescription>{t("social.ai.form.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("social.ai.form.event")}</Label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("social.ai.form.no_event")}</SelectItem>
                {(eventsQ.data?.items ?? []).map((ev) => (
                  <SelectItem key={ev.id} value={ev.id}>
                    {new Date(ev.performance_date).toLocaleDateString()} — {ev.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("social.ai.form.prompt")}</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("social.ai.form.prompt_placeholder")}
              rows={4}
              maxLength={4000}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("social.ai.form.tone")}</Label>
            <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="informational">{t("social.ai.tones.informational")}</SelectItem>
                <SelectItem value="promotional">{t("social.ai.tones.promotional")}</SelectItem>
                <SelectItem value="celebratory">{t("social.ai.tones.celebratory")}</SelectItem>
                <SelectItem value="behind_the_scenes">{t("social.ai.tones.behind_the_scenes")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("social.ai.form.platforms")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {SOCIAL_PLATFORM_ORDER.filter((p) => SOCIAL_PLATFORMS[p].supportsText || SOCIAL_PLATFORMS[p].supportsVideo).map((pid) => {
                const checked = selectedPlatforms.includes(pid);
                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => togglePlatform(pid)}
                    className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition ${
                      checked
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {checked ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    <span>{t(`social.platforms.${pid}.name`)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {t("social.ai.actions.generate")}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {!generated ? (
          <Card className="border-dashed">
            <CardContent className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <Sparkles className="h-12 w-12 opacity-30" />
              <p className="max-w-sm text-sm">{t("social.ai.empty")}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {bestTime && (
              <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40">
                <CardContent className="flex items-center gap-3 py-3">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-blue-700 dark:text-blue-300">
                      {t("social.ai.best_time")}
                    </div>
                    <div className="text-sm">{bestTime}</div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4">
              {selectedPlatforms.map((pid) => {
                const content = generated[pid];
                if (!content) return null;
                const meta = SOCIAL_PLATFORMS[pid];
                const fullLength =
                  content.text.length +
                  (content.hashtags.length ? content.hashtags.join(" ").length + 1 : 0);
                const overLimit = meta.maxTextLength !== null && fullLength > meta.maxTextLength;
                return (
                  <Card key={pid}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider">
                          {t(`social.platforms.${pid}.name`)}
                        </CardTitle>
                        <Badge variant={overLimit ? "destructive" : "secondary"}>
                          {fullLength}
                          {meta.maxTextLength ? ` / ${meta.maxTextLength}` : ""}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">
                        {content.text}
                      </div>
                      {content.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {content.hashtags.map((h, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              #{h.replace(/^#/, "")}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditedPlatform(pid)}
                      >
                        {t("social.ai.actions.edit")}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Separator />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setGenerated(null); setBestTime(null); }}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSaveAsDraft}>
                <Save className="mr-2 h-4 w-4" />
                {t("social.ai.actions.save_draft")}
              </Button>
            </div>
          </>
        )}
      </div>

      {editedPlatform && generated && generated[editedPlatform] && (
        <Dialog open onOpenChange={() => setEditedPlatform(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {t("social.ai.edit_title", { platform: t(`social.platforms.${editedPlatform}.name`) })}
              </DialogTitle>
              <DialogDescription>{t("social.ai.edit_subtitle")}</DialogDescription>
            </DialogHeader>
            <Textarea
              value={generated[editedPlatform].text}
              onChange={(e) =>
                setGenerated({
                  ...generated,
                  [editedPlatform]: { ...generated[editedPlatform], text: e.target.value },
                })
              }
              rows={10}
            />
            <Label className="mt-2">{t("social.ai.hashtags")}</Label>
            <Textarea
              value={generated[editedPlatform].hashtags.join(" ")}
              onChange={(e) =>
                setGenerated({
                  ...generated,
                  [editedPlatform]: {
                    ...generated[editedPlatform],
                    hashtags: e.target.value
                      .split(/\s+/)
                      .map((s) => s.trim().replace(/^#/, ""))
                      .filter(Boolean),
                  },
                })
              }
              rows={2}
            />
            <DialogFooter>
              <Button onClick={() => setEditedPlatform(null)}>
                <ArrowRight className="mr-2 h-4 w-4" />
                {t("common.done")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
