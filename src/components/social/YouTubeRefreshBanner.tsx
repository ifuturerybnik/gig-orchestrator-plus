import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getAppCredentials } from "@/lib/social.functions";

const REFRESH_TOKEN_TTL_DAYS = 7;

/**
 * Banner w szczegółach konta YouTube — pokazuje, ile dni zostało
 * do wygaśnięcia refresh_tokena (limit Google przy OAuth=Testing).
 * Bazujemy na social_app_credentials.extra.youtube_oauth_testing
 * + social_accounts.updated_at (data ostatniego odświeżenia/połączenia).
 */
export function YouTubeRefreshBanner({
  orgId,
  updatedAt,
}: {
  orgId: string;
  updatedAt: string;
}) {
  const { t } = useTranslation();
  const getFn = useServerFn(getAppCredentials);
  const credQ = useQuery({
    queryKey: ["social-app-credentials", orgId, "youtube"],
    queryFn: () => getFn({ data: { organizationId: orgId, platform: "youtube" } }),
  });

  if (credQ.isLoading || !credQ.data) return null;
  const testing = credQ.data.youtubeOauthTesting === true;

  if (!testing) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs dark:border-emerald-900 dark:bg-emerald-950/40">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div>
            <div className="font-medium text-emerald-900 dark:text-emerald-100">
              {t("social.account_details.youtube_refresh.production_title")}
            </div>
            <div className="mt-0.5 text-emerald-800 dark:text-emerald-200">
              {t("social.account_details.youtube_refresh.production_body")}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const grantedAt = new Date(updatedAt).getTime();
  const expiresAt = grantedAt + REFRESH_TOKEN_TTL_DAYS * 24 * 3600 * 1000;
  const msLeft = expiresAt - Date.now();
  const daysLeft = Math.floor(msLeft / (24 * 3600 * 1000));
  const expired = msLeft <= 0;
  const expiringSoon = !expired && daysLeft <= 2;

  if (expired) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">
              {t("social.account_details.youtube_refresh.expired_title")}
            </div>
            <div className="mt-0.5">
              {t("social.account_details.youtube_refresh.expired_body")}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tone = expiringSoon
    ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
    : "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40";
  const Icon = expiringSoon ? AlertTriangle : AlertCircle;
  const iconColor = expiringSoon
    ? "text-amber-600"
    : "text-sky-700 dark:text-sky-300";

  return (
    <div className={`rounded-md border p-3 text-xs ${tone}`}>
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
        <div>
          <div className="font-medium">
            {t("social.account_details.youtube_refresh.testing_title", {
              days: daysLeft,
            })}
          </div>
          <div className="mt-0.5 text-muted-foreground">
            {t("social.account_details.youtube_refresh.testing_body")}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {t("social.account_details.youtube_refresh.testing_expires_at", {
              date: new Date(expiresAt).toLocaleString(),
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
