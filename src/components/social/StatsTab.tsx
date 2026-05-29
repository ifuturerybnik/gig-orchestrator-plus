import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BarChart3, Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { aiAnalyzeEngagement } from "@/lib/social.functions";

export function StatsTab({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const analyzeFn = useServerFn(aiAnalyzeEngagement);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const res = await analyzeFn({ data: { organizationId: orgId } });
      setSummary(res.summary);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" />
            {t("social.stats.title")}
          </CardTitle>
          <CardDescription>{t("social.stats.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            {t("social.stats.empty_state")}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            {t("social.stats.ai_analysis_title")}
          </CardTitle>
          <CardDescription>{t("social.stats.ai_analysis_subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleAnalyze} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {t("social.stats.run_analysis")}
          </Button>
          {summary && (
            <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm">
              {summary}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
