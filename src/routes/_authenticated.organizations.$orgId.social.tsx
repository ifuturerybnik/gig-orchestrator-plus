import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Share2 } from "lucide-react";
import { PlatformsTab } from "@/components/social/PlatformsTab";
import { AiStudioTab } from "@/components/social/AiStudioTab";
import { ScheduleTab } from "@/components/social/ScheduleTab";
import { StatsTab } from "@/components/social/StatsTab";

export const Route = createFileRoute(
  "/_authenticated/organizations/$orgId/social",
)({
  component: SocialIntegrationsPage,
});

function SocialIntegrationsPage() {
  const { orgId } = Route.useParams();
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Share2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("social.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("social.subtitle")}</p>
        </div>
      </header>

      <Tabs defaultValue="accounts" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="accounts">{t("social.tabs.accounts")}</TabsTrigger>
          <TabsTrigger value="ai">{t("social.tabs.ai_studio")}</TabsTrigger>
          <TabsTrigger value="schedule">{t("social.tabs.schedule")}</TabsTrigger>
          <TabsTrigger value="stats">{t("social.tabs.stats")}</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-6">
          <PlatformsTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="ai" className="mt-6">
          <AiStudioTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="schedule" className="mt-6">
          <ScheduleTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="stats" className="mt-6">
          <StatsTab orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
