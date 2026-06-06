import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  Trash2,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  getAppCredentials,
  saveAppCredentials,
  deleteAppCredentials,
} from "@/lib/social.functions";
import type { SocialPlatformId } from "@/lib/social-platforms";
import { XSetupInstructions } from "./XSetupInstructions";
import { LinkedInSetupInstructions } from "./LinkedInSetupInstructions";
import { MetaSetupInstructions } from "./MetaSetupInstructions";
import { YouTubeSetupInstructions } from "./YouTubeSetupInstructions";
import { TikTokSetupInstructions } from "./TikTokSetupInstructions";
import { SpotifySetupInstructions } from "./SpotifySetupInstructions";



/**
 * Formularz konfiguracji Client ID + Client Secret per organizacja.
 * Działa dla każdej platformy SM. Dla X (Twitter) pokazuje pełną
 * łopatologiczną instrukcję — dla pozostałych pokazuje placeholder.
 */
export function AppCredentialsForm({
  orgId,
  platform,
  onConfigured,
}: {
  orgId: string;
  platform: SocialPlatformId;
  onConfigured?: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const getFn = useServerFn(getAppCredentials);
  const saveFn = useServerFn(saveAppCredentials);
  const deleteFn = useServerFn(deleteAppCredentials);

  const credQ = useQuery({
    queryKey: ["social-app-credentials", orgId, platform],
    queryFn: () => getFn({ data: { organizationId: orgId, platform } }),
  });

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [metaConfigId, setMetaConfigId] = useState("");
  const [youtubeTesting, setYoutubeTesting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const isFacebookPlatform = platform === "facebook";
  const isYouTube = platform === "youtube";


  // Slug callback URL: X używa "x", Facebook używa "meta",
  // Spotify używa skróconego "spotify", reszta = id platformy.
  const callbackSlug =
    platform === "twitter"
      ? "x"
      : platform === "facebook"
        ? "meta"
        : platform === "spotify_artists"
          ? "spotify"
          : platform;
  const callbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/social/${callbackSlug}-callback`
      : "";

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          organizationId: orgId,
          platform,
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          metaConfigId: isFacebookPlatform ? metaConfigId.trim() : undefined,
          youtubeOauthTesting: isYouTube ? youtubeTesting : undefined,
        },
      }),
    onSuccess: () => {
      toast.success(t("social.setup.saved"));
      setClientId("");
      setClientSecret("");
      setMetaConfigId("");
      qc.invalidateQueries({ queryKey: ["social-app-credentials", orgId, platform] });
      qc.invalidateQueries({ queryKey: ["platform-readiness", platform, orgId] });
      onConfigured?.();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });


  const delMut = useMutation({
    mutationFn: () =>
      deleteFn({ data: { organizationId: orgId, platform } }),
    onSuccess: () => {
      toast.success(t("social.setup.deleted"));
      qc.invalidateQueries({ queryKey: ["social-app-credentials", orgId, platform] });
      qc.invalidateQueries({ queryKey: ["platform-readiness", platform, orgId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const copyCallback = async () => {
    try {
      await navigator.clipboard.writeText(callbackUrl);
      toast.success(t("social.setup.callback_copied"));
    } catch {
      /* ignore */
    }
  };

  const existing = credQ.data;

  useEffect(() => {
    if (platform === "facebook" && existing?.metaConfigId) {
      setMetaConfigId(existing.metaConfigId);
    }
    if (isYouTube && typeof existing?.youtubeOauthTesting === "boolean") {
      setYoutubeTesting(existing.youtubeOauthTesting);
    }
  }, [existing?.metaConfigId, existing?.youtubeOauthTesting, platform, isYouTube]);


  return (
    <div className="space-y-4">
      {existing?.exists && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertTitle>{t("social.setup.already_configured")}</AlertTitle>
          <AlertDescription className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Client ID:</span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {existing.clientIdMasked}
              </code>
            </div>
            {platform === "facebook" && existing.metaConfigId && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Configuration ID:</span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {existing.metaConfigId}
                </code>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => delMut.mutate()}
              disabled={delMut.isPending}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1 h-3 w-3" />
              {t("social.setup.delete_credentials")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Callback URL */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
          <ShieldCheck className="h-3.5 w-3.5" />
          {t("social.setup.callback_url_label")}
        </Label>
        <div className="flex items-stretch gap-2">
          <Input value={callbackUrl} readOnly className="font-mono text-xs" />
          <Button variant="outline" size="sm" onClick={copyCallback}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("social.setup.callback_url_hint")}
        </p>
      </div>

      {/* Instrukcja krok-po-kroku */}
      <Accordion type="single" collapsible defaultValue={existing?.exists ? undefined : "instructions"}>
        <AccordionItem value="instructions">
          <AccordionTrigger className="text-sm font-semibold">
            <span className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              {t("social.setup.instructions_title")}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            {platform === "twitter" ? (
              <XSetupInstructions callbackUrl={callbackUrl} />
            ) : platform === "linkedin" ? (
              <LinkedInSetupInstructions callbackUrl={callbackUrl} />
            ) : platform === "facebook" || platform === "instagram" ? (
              <MetaSetupInstructions callbackUrl={callbackUrl} />
            ) : platform === "youtube" ? (
              <YouTubeSetupInstructions callbackUrl={callbackUrl} />
            ) : platform === "tiktok" ? (
              <TikTokSetupInstructions callbackUrl={callbackUrl} />
            ) : platform === "spotify_artists" ? (
              <SpotifySetupInstructions callbackUrl={callbackUrl} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("social.setup.instructions_coming_soon")}
              </p>
            )}

          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Formularz */}
      <div className="space-y-3 rounded-md border p-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">
            {existing?.exists
              ? t("social.setup.update_title")
              : t("social.setup.enter_title")}
          </h4>
          {existing?.exists && (
            <Badge variant="secondary" className="ml-auto">
              {t("social.setup.update_hint")}
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-id">Client ID</Label>
          <Input
            id="client-id"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder={t("social.setup.client_id_placeholder")}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-secret">Client Secret</Label>
          <div className="relative">
            <Input
              id="client-secret"
              type={showSecret ? "text" : "password"}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={t("social.setup.client_secret_placeholder")}
              autoComplete="off"
              spellCheck={false}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowSecret((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("social.setup.secret_hint")}
          </p>
        </div>

        {isFacebookPlatform && (
          <div className="space-y-2">
            <Label htmlFor="meta-config-id">Facebook Login for Business — Configuration ID</Label>
            <Input
              id="meta-config-id"
              value={metaConfigId}
              onChange={(e) => setMetaConfigId(e.target.value)}
              placeholder="123456789012345"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              W Meta for Developers: Facebook Login for Business → Configurations → skopiuj Configuration ID z konfiguracji zawierającej Facebook Pages i Instagram.
            </p>
          </div>
        )}

        {isYouTube && (
          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="yt-testing" className="text-sm">
                  {t("social.setup.youtube.testing_label")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("social.setup.youtube.testing_desc")}
                </p>
              </div>
              <input
                id="yt-testing"
                type="checkbox"
                checked={youtubeTesting}
                onChange={(e) => setYoutubeTesting(e.target.checked)}
                className="mt-1 h-4 w-4 accent-amber-600"
              />
            </div>
            {youtubeTesting && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {t("social.setup.youtube.testing_warning")}
              </p>
            )}
          </div>
        )}


        <Button
          onClick={() => saveMut.mutate()}
          disabled={
            saveMut.isPending ||
            clientId.trim().length < 3 ||
            clientSecret.trim().length < 3
          }
          className="w-full"
        >
          {saveMut.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {existing?.exists
            ? t("social.setup.save_update")
            : t("social.setup.save_new")}
        </Button>
      </div>
    </div>
  );
}
