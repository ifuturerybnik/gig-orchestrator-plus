import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiStudioCreateTab } from "@/components/ai-studio/AiStudioCreateTab";
import { PlaceholderTab } from "@/components/ai-studio/PlaceholderTab";
import { InboxTab } from "@/components/social/InboxTab";
import { ScheduleTab } from "@/components/social/ScheduleTab";
import { StatsTab } from "@/components/social/StatsTab";

export const Route = createFileRoute(
  "/_authenticated/organizations/$orgId/ai-studio",
)({
  component: AiStudioPage,
});

function AiStudioPage() {
  const { t } = useTranslation();
  const { orgId } = Route.useParams();

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("ai_studio.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("ai_studio.subtitle")}</p>
        </div>
      </header>

      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full max-w-4xl grid-cols-7">
          <TabsTrigger value="dashboard">{t("ai_studio.tabs.dashboard")}</TabsTrigger>
          <TabsTrigger value="create">{t("ai_studio.tabs.create")}</TabsTrigger>
          <TabsTrigger value="calendar">{t("ai_studio.tabs.calendar")}</TabsTrigger>
          <TabsTrigger value="inbox">{t("ai_studio.tabs.inbox")}</TabsTrigger>
          <TabsTrigger value="library">{t("ai_studio.tabs.library")}</TabsTrigger>
          <TabsTrigger value="analytics">{t("ai_studio.tabs.analytics")}</TabsTrigger>
          <TabsTrigger value="assistant">{t("ai_studio.tabs.assistant")}</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <PlaceholderTab titleKey="ai_studio.tabs.dashboard" descKey="ai_studio.placeholders.dashboard" />
        </TabsContent>
        <TabsContent value="create" className="mt-6">
          <AiStudioCreateTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="calendar" className="mt-6">
          <ScheduleTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="inbox" className="mt-6">
          <InboxTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="library" className="mt-6">
          <PlaceholderTab titleKey="ai_studio.tabs.library" descKey="ai_studio.placeholders.library" />
        </TabsContent>
        <TabsContent value="analytics" className="mt-6">
          <StatsTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="assistant" className="mt-6">
          <PlaceholderTab titleKey="ai_studio.tabs.assistant" descKey="ai_studio.placeholders.assistant" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
