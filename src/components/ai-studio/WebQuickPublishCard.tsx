import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Globe, Loader2, Sparkles, Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { WysiwygEditor } from "@/components/ui/wysiwyg-editor";
import { callAi } from "@/lib/ai.functions";
import { upsertWebNews } from "@/lib/web.functions";

/**
 * Szybka publikacja aktualności WWW z poziomu AI Studio.
 * Korzysta z istniejących server fn (upsertWebNews + callAi) — nie duplikuje logiki.
 * Pełny edytor wydarzeń/galerii zostaje w module Web; tu jest skrót dla najczęstszego flow.
 */
export function WebQuickPublishCard({ orgId }: { orgId: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "pl";
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [html, setHtml] = useState("");
  const [publishNow, setPublishNow] = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [pubLoading, setPubLoading] = useState(false);

  const aiFn = useServerFn(callAi);
  const publishFn = useServerFn(upsertWebNews);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error(t("ai_studio.web.errors.no_topic"));
      return;
    }
    setGenLoading(true);
    try {
      const sys =
        lang === "pl"
          ? "Jesteś redaktorem strony internetowej organizacji muzyczno-eventowej. Tworzysz krótkie, treściwe aktualności (newsy) z chwytliwym tytułem i zajawką. Zwracasz WYŁĄCZNIE poprawny JSON."
          : "You are a content editor for a music/event organization's website. You write concise news posts with a catchy title and lede. Return ONLY valid JSON.";
      const user =
        (lang === "pl"
          ? `Wygeneruj aktualność na podstawie tematu: "${topic}".\n`
          : `Generate a news post based on the topic: "${topic}".\n`) +
        `Zwróć JSON: { "title": "...", "excerpt": "...", "html": "<p>...</p>" }. ` +
        `Treść (html) 2-4 krótkie akapity, semantyczny HTML (<p>, <strong>, <em>, <ul>/<li>). ` +
        `Bez nagłówków <h1>-<h3>. Brak tekstu poza JSON.`;
      const res = await aiFn({
        data: {
          scenariusz: "web_news_from_prompt",
          systemPrompt: sys,
          userPrompt: user,
          maxTokens: 1500,
        },
      });
      let raw = (res.text ?? "").trim();
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) raw = fence[1].trim();
      const parsed = JSON.parse(raw) as {
        title?: string;
        excerpt?: string;
        html?: string;
      };
      setTitle(parsed.title ?? "");
      setExcerpt(parsed.excerpt ?? "");
      setHtml(parsed.html ?? "");
      toast.success(t("ai_studio.web.toast.generated"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setGenLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!title.trim() || !html.trim()) {
      toast.error(t("ai_studio.web.errors.no_content"));
      return;
    }
    setPubLoading(true);
    try {
      await publishFn({
        data: {
          organizationId: orgId,
          titleI18n: { [lang]: title },
          excerptI18n: excerpt ? { [lang]: excerpt } : {},
          contentHtmlI18n: { [lang]: html },
          coverImageUrl: null,
          galleryImageUrls: [],
          tags: [],
          isPublic: publishNow,
        },
      });
      toast.success(
        publishNow
          ? t("ai_studio.web.toast.published")
          : t("ai_studio.web.toast.saved_draft"),
      );
      setTopic("");
      setTitle("");
      setExcerpt("");
      setHtml("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setPubLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4 text-primary" />
          {t("ai_studio.web.title")}
        </CardTitle>
        <CardDescription>{t("ai_studio.web.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{t("ai_studio.web.topic")}</Label>
          <Textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t("ai_studio.web.topic_placeholder")}
            rows={2}
            maxLength={2000}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={genLoading}
          >
            {genLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {t("ai_studio.web.generate")}
          </Button>
        </div>

        <div className="space-y-2">
          <Label>{t("ai_studio.web.field_title")}</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={250} />
        </div>
        <div className="space-y-2">
          <Label>{t("ai_studio.web.field_excerpt")}</Label>
          <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} maxLength={500} />
        </div>
        <div className="space-y-2">
          <Label>{t("ai_studio.web.field_content")}</Label>
          <WysiwygEditor value={html} onChange={setHtml} minHeight="220px" />
        </div>

        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3">
          <Switch checked={publishNow} onCheckedChange={setPublishNow} />
          <div className="text-sm">
            <div className="font-medium">{t("ai_studio.web.publish_now")}</div>
            <div className="text-xs text-muted-foreground">
              {t("ai_studio.web.publish_now_hint")}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handlePublish} disabled={pubLoading}>
            {pubLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {publishNow ? t("ai_studio.web.cta_publish") : t("ai_studio.web.cta_save_draft")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
