import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Facebook,
  Instagram,
  Youtube,
  Linkedin,
  Twitter,
  Music2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  DollarSign,
  HelpCircle,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { listSocialAccounts } from "@/lib/social.functions";
import {
  SOCIAL_PLATFORM_ORDER,
  SOCIAL_PLATFORMS,
  type SocialPlatformId,
} from "@/lib/social-platforms";
import { ConnectWizardDialog } from "./ConnectWizardDialog";
import { PlatformInfoDialog } from "./PlatformInfoDialog";
import { AccountDetailsDialog } from "./AccountDetailsDialog";
import { SocialDiagnosticsAiDialog } from "./SocialDiagnosticsAiDialog";

const PLATFORM_ICONS: Record<SocialPlatformId, React.ComponentType<{ className?: string }>> = {
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  linkedin: Linkedin,
  twitter: Twitter,
  tiktok: Music2,
  spotify_artists: Music2,
};

export function PlatformsTab({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const [wizardPlatform, setWizardPlatform] = useState<SocialPlatformId | null>(null);
  const [infoPlatform, setInfoPlatform] = useState<SocialPlatformId | null>(null);
  const [detailsAccountId, setDetailsAccountId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const fetchAccounts = useServerFn(listSocialAccounts);
  const accountsQ = useQuery({
    queryKey: ["social-accounts", orgId],
    queryFn: () => fetchAccounts({ data: { organizationId: orgId } }),
  });

  const accountsByPlatform = new Map(
    (accountsQ.data?.items ?? []).map((a) => [a.platform, a]),
  );

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-amber-600" />
            {t("social.intro.title")}
          </CardTitle>
          <CardDescription className="text-amber-900 dark:text-amber-100">
            {t("social.intro.body")}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SOCIAL_PLATFORM_ORDER.map((pid) => {
          const meta = SOCIAL_PLATFORMS[pid];
          const Icon = PLATFORM_ICONS[pid];
          const account = accountsByPlatform.get(pid);
          const isConnected = !!account;

          return (
            <Card key={pid} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white ${meta.brandColor}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">
                      {t(`social.platforms.${pid}.name`)}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {t(`social.platforms.${pid}.tagline`)}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {isConnected ? (
                      account?.status === "demo" ? (
                        <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Demo
                        </Badge>
                      ) : (
                        <Badge variant="default" className="bg-emerald-600">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          {t("social.status.connected")}
                        </Badge>
                      )
                    ) : meta.status === "coming_soon" ? (
                      <Badge variant="secondary">
                        <Clock className="mr-1 h-3 w-3" />
                        {t("social.status.coming_soon")}
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        {t("social.status.planned")}
                      </Badge>
                    )}
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setInfoPlatform(pid)}
                            aria-label={t("social.info_dialog.aria_open", { platform: t(`social.platforms.${pid}.name`) })}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <HelpCircle className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t("social.info_dialog.tooltip")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <div className="space-y-1.5 text-xs">
                  {meta.supportsText && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      <span>{t("social.caps.text")}</span>
                    </div>
                  )}
                  {meta.supportsImages && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      <span>{t("social.caps.images")}</span>
                    </div>
                  )}
                  {meta.supportsVideo && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      <span>{t("social.caps.video")}</span>
                    </div>
                  )}
                  {meta.supportsMetrics && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      <span>{t("social.caps.metrics")}</span>
                    </div>
                  )}
                  {meta.requiresPaidApi && (
                    <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                      <DollarSign className="h-3 w-3" />
                      <span>{t("social.caps.paid_api")}</span>
                    </div>
                  )}
                </div>

                {isConnected && account ? (
                  <button
                    type="button"
                    onClick={() => setDetailsAccountId(account.id)}
                    className="mt-auto rounded-md border bg-muted/30 px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="font-medium truncate">{account.account_name}</div>
                    <div className="text-muted-foreground">
                      {account.status === "demo" ? (
                        <span className="text-amber-700 dark:text-amber-400">
                          Wpis testowy (seed) — rozłącz i połącz prawdziwie
                        </span>
                      ) : (
                        <>
                          {t("social.connected_at")}:{" "}
                          {new Date(account.connected_at).toLocaleDateString()}
                        </>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-primary">
                      {t("social.account_details.open_link")} →
                    </div>
                  </button>
                ) : (
                  <Button
                    variant={meta.status === "coming_soon" ? "default" : "outline"}
                    className="mt-auto"
                    onClick={() => setWizardPlatform(pid)}
                  >
                    {meta.status === "live"
                      ? t("social.actions.connect")
                      : t("social.actions.learn_more")}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {wizardPlatform && (
        <ConnectWizardDialog
          platform={wizardPlatform}
          orgId={orgId}
          open={!!wizardPlatform}
          onClose={() => setWizardPlatform(null)}
        />
      )}

      {infoPlatform && (
        <PlatformInfoDialog
          platform={infoPlatform}
          open={!!infoPlatform}
          onClose={() => setInfoPlatform(null)}
        />
      )}

      {detailsAccountId && (() => {
        const acc = (accountsQ.data?.items ?? []).find((a) => a.id === detailsAccountId);
        if (!acc) return null;
        return (
          <AccountDetailsDialog
            account={acc}
            open={!!detailsAccountId}
            onClose={() => setDetailsAccountId(null)}
          />
        );
      })()}
    </div>
  );
}
