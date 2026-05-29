import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Inbox, MessageSquare, Shield, Sparkles, Bell, History } from "lucide-react";

export function InboxTab({ orgId: _orgId }: { orgId: string }) {
  const { t } = useTranslation();

  const features = [
    { icon: Inbox, key: "unified_inbox" },
    { icon: MessageSquare, key: "quick_reply" },
    { icon: Shield, key: "moderation" },
    { icon: Sparkles, key: "ai_replies" },
    { icon: Sparkles, key: "ai_moderator" },
    { icon: Bell, key: "notifications" },
    { icon: History, key: "user_history" },
  ] as const;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">{t("social.inbox.title")}</CardTitle>
            </div>
            <Badge variant="secondary">{t("social.inbox.coming_soon_badge")}</Badge>
          </div>
          <CardDescription>{t("social.inbox.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            {t("social.inbox.empty_state")}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("social.inbox.features_title")}</CardTitle>
          <CardDescription>{t("social.inbox.features_subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            {features.map(({ icon: Icon, key }) => (
              <li key={key} className="flex items-start gap-3 rounded-md border bg-card/50 p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-tight">
                    {t(`social.inbox.features.${key}.title`)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`social.inbox.features.${key}.desc`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

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
                        <span className={
                          v === "yes" ? "text-emerald-600 dark:text-emerald-400" :
                          v === "partial" ? "text-amber-600 dark:text-amber-400" :
                          "text-muted-foreground"
                        }>
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
