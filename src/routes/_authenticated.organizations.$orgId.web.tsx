import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Globe, Newspaper, CalendarDays, Images, Cable } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WebNewsTab } from "@/components/web/WebNewsTab";
import { WebEventsTab } from "@/components/web/WebEventsTab";
import { WebGalleryTab } from "@/components/web/WebGalleryTab";
import { WebIntegrationTab } from "@/components/web/WebIntegrationTab";

export const Route = createFileRoute(
  "/_authenticated/organizations/$orgId/web",
)({
  component: WebPage,
});

function WebPage() {
  const { orgId } = Route.useParams();
  const { t } = useTranslation();

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Globe className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">
            {t("organizations.sidebar.web")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("web.subtitle")}</p>
        </div>
      </div>

      <Tabs defaultValue="news">
        <TabsList className="mb-6">
          <TabsTrigger value="news" className="gap-2">
            <Newspaper className="h-4 w-4" />
            {t("web.tabs.news")}
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            {t("web.tabs.events")}
          </TabsTrigger>
          <TabsTrigger value="gallery" className="gap-2">
            <Images className="h-4 w-4" />
            {t("web.tabs.gallery")}
          </TabsTrigger>
          <TabsTrigger value="integration" className="gap-2">
            <Cable className="h-4 w-4" />
            {t("web.tabs.integration")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="news">
          <WebNewsTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="events">
          <WebEventsTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="gallery">
          <WebGalleryTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="integration">
          <WebIntegrationTab orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

