import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Share2, Sparkles, Info } from "lucide-react";
import { PlatformsTab } from "@/components/social/PlatformsTab";
import { AiStudioTab } from "@/components/social/AiStudioTab";
import { ScheduleTab } from "@/components/social/ScheduleTab";
import { StatsTab } from "@/components/social/StatsTab";
import { InboxTab } from "@/components/social/InboxTab";

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

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>{t("social.deprecated.title")}</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{t("social.deprecated.description")}</p>
          <Button asChild size="sm" variant="default">
            <Link to="/organizations/$orgId/ai-studio" params={{ orgId }}>
              <Sparkles className="mr-2 h-4 w-4" />
              {t("social.deprecated.cta")}
            </Link>
          </Button>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="accounts" className="w-full">
        <TabsList className="grid w-full max-w-3xl grid-cols-5">
          <TabsTrigger value="accounts">{t("social.tabs.accounts")}</TabsTrigger>
          <TabsTrigger value="inbox">{t("social.tabs.inbox")}</TabsTrigger>
          <TabsTrigger value="ai">{t("social.tabs.ai_studio")}</TabsTrigger>
          <TabsTrigger value="schedule">{t("social.tabs.schedule")}</TabsTrigger>
          <TabsTrigger value="stats">{t("social.tabs.stats")}</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-6">
          <PlatformsTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="inbox" className="mt-6">
          <InboxTab orgId={orgId} />
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
