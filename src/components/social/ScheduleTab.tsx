import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, FileText, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { listSocialPosts } from "@/lib/social.functions";
import { SOCIAL_PLATFORMS, type SocialPlatformId } from "@/lib/social-platforms";

export function ScheduleTab({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const fetchPosts = useServerFn(listSocialPosts);
  const postsQ = useQuery({
    queryKey: ["social-posts", orgId],
    queryFn: () => fetchPosts({ data: { organizationId: orgId } }),
  });

  const items = postsQ.data?.items ?? [];
  const scheduledDays = items
    .filter((p) => p.scheduled_at)
    .map((p) => new Date(p.scheduled_at!));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-primary" />
              {t("social.schedule.calendar_title")}
            </CardTitle>
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
          <CardTitle className="text-base">{t("social.schedule.list_title")}</CardTitle>
          <CardDescription>{t("social.schedule.list_subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <FileText className="h-8 w-8 opacity-30" />
              <p>{t("social.schedule.empty")}</p>
            </div>
          ) : (
            items.map((p) => (
              <div key={p.id} className="rounded-md border p-3 text-sm">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {p.target_platforms.map((pid) => (
                      <Badge key={pid} variant="outline" className="text-xs">
                        {t(`social.platforms.${pid as SocialPlatformId}.name`)}
                      </Badge>
                    ))}
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
                <div className="line-clamp-2 text-muted-foreground">
                  {Object.values(p.content_per_platform)[0]?.text ?? "—"}
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  {p.scheduled_at && (
                    <span>
                      <CalendarClock className="mr-1 inline h-3 w-3" />
                      {new Date(p.scheduled_at).toLocaleString()}
                    </span>
                  )}
                  {p.ai_generated && (
                    <span className="flex items-center gap-1 text-primary">
                      <Sparkles className="h-3 w-3" /> AI
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
