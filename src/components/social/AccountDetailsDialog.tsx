import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ExternalLink,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  disconnectSocialAccount,
  importPostsFromAccountFn,
  setAccountAutomation,
  type SocialAccountRow,
} from "@/lib/social.functions";
import { SOCIAL_PLATFORMS, type SocialPlatformId } from "@/lib/social-platforms";

function externalUrlFor(account: SocialAccountRow): string | null {
  const id = account.external_account_id;
  const name = account.account_name?.replace(/^@/, "") ?? "";
  switch (account.platform) {
    case "facebook":
      return `https://facebook.com/${id}`;
    case "instagram":
      return name ? `https://instagram.com/${name}` : null;
    case "youtube":
      return `https://youtube.com/channel/${id}`;
    case "linkedin":
      return `https://linkedin.com/company/${id}`;
    case "twitter":
      return name ? `https://x.com/${name}` : null;
    case "tiktok":
      return name ? `https://tiktok.com/@${name}` : null;
    default:
      return null;
  }
}

export function AccountDetailsDialog({
  account,
  open,
  onClose,
}: {
  account: SocialAccountRow;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const disconnectFn = useServerFn(disconnectSocialAccount);
  const importFn = useServerFn(importPostsFromAccountFn);
  const meta = SOCIAL_PLATFORMS[account.platform as SocialPlatformId];
  const externalUrl = externalUrlFor(account);
  const supportsImport =
    account.platform === "facebook" ||
    account.platform === "instagram" ||
    account.platform === "youtube";
  const isLegacyInstagram =
    account.platform === "instagram" &&
    !(account.scopes ?? []).some((scope) => scope.startsWith("instagram_business_"));

  const disconnectM = useMutation({
    mutationFn: () =>
      disconnectFn({
        data: {
          organizationId: account.organization_id,
          accountId: account.id,
        },
      }),
    onSuccess: () => {
      toast.success(t("social.account_details.disconnect_success"));
      qc.invalidateQueries({ queryKey: ["social-accounts", account.organization_id] });
      onClose();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : String(e)),
  });

  const importM = useMutation({
    mutationFn: () =>
      importFn({
        data: {
          organizationId: account.organization_id,
          platform: account.platform as SocialPlatformId,
          limit: 25,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        t("social.account_details.import_success", {
          inserted: res.inserted,
          fetched: res.fetched,
        }),
      );
      qc.invalidateQueries({ queryKey: ["social-posts", account.organization_id] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : String(e)),
  });

  const automationFn = useServerFn(setAccountAutomation);
  const [autoSync, setAutoSync] = useState<boolean>(account.auto_sync_inbox);
  const [autoAi, setAutoAi] = useState<boolean>(account.auto_ai_moderation);
  const pausedUntil = account.sync_paused_until
    ? new Date(account.sync_paused_until)
    : null;
  const isPaused = !!pausedUntil && pausedUntil > new Date();

  const automationM = useMutation({
    mutationFn: (patch: {
      autoSyncInbox?: boolean;
      autoAiModeration?: boolean;
      syncPausedUntil?: string | null;
    }) =>
      automationFn({
        data: {
          organizationId: account.organization_id,
          accountId: account.id,
          ...patch,
        },
      }),
    onSuccess: () => {
      toast.success(t("social.account_details.automation.saved"));
      qc.invalidateQueries({ queryKey: ["social-accounts", account.organization_id] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : String(e)),
  });

  const isError = account.status === "error" || !!account.last_error;


  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t(`social.platforms.${account.platform}.name`)} — {account.account_name}
          </DialogTitle>
          <DialogDescription>
            {t("social.account_details.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">
              {t("social.account_details.publish_target")}
            </div>
            <div className="mt-0.5 font-medium">{account.account_name}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              ID: <code className="font-mono">{account.external_account_id}</code>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-muted-foreground">
                {t("social.account_details.status")}
              </div>
              <div className="mt-0.5">
                {isError ? (
                  <Badge variant="destructive">
                    <AlertCircle className="mr-1 h-3 w-3" />
                    {t("social.account_details.status_error")}
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-600">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    {t("social.account_details.status_ok")}
                  </Badge>
                )}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">
                {t("social.account_details.connected_at")}
              </div>
              <div className="mt-0.5">
                {new Date(account.connected_at).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">
                {t("social.account_details.last_sync")}
              </div>
              <div className="mt-0.5">
                {account.last_sync_at
                  ? new Date(account.last_sync_at).toLocaleString()
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">
                {t("social.account_details.token_expires")}
              </div>
              <div className="mt-0.5">
                {account.token_expires_at
                  ? new Date(account.token_expires_at).toLocaleString()
                  : t("social.account_details.no_expiry")}
              </div>
            </div>
          </div>

          {account.scopes?.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                {t("social.account_details.scopes")}
              </div>
              <div className="flex flex-wrap gap-1">
                {account.scopes.map((s) => (
                  <Badge key={s} variant="secondary" className="font-mono text-[10px]">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {isLegacyInstagram && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
              {t(
                "social.account_details.instagram_reconnect_required",
                "Rozłącz Instagram i połącz ponownie przyciskiem Połącz z Instagram, akceptując instagram_business_manage_comments",
              )}
            </div>
          )}

          {isError && account.last_error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
              <div className="font-medium mb-1">
                {t("social.account_details.last_error")}
              </div>
              <div className="break-words">{account.last_error}</div>
            </div>
          )}

          <Separator />

          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <div>
              <div className="text-sm font-medium">
                {t("social.account_details.automation.title")}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {t("social.account_details.automation.subtitle")}
              </div>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor={`auto-sync-${account.id}`} className="text-sm">
                  {t("social.account_details.automation.auto_sync_label")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("social.account_details.automation.auto_sync_desc")}
                </p>
              </div>
              <Switch
                id={`auto-sync-${account.id}`}
                checked={autoSync}
                disabled={automationM.isPending}
                onCheckedChange={(v) => {
                  setAutoSync(v);
                  automationM.mutate({ autoSyncInbox: v });
                }}
              />
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor={`auto-ai-${account.id}`} className="text-sm">
                  {t("social.account_details.automation.auto_ai_label")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("social.account_details.automation.auto_ai_desc")}
                </p>
              </div>
              <Switch
                id={`auto-ai-${account.id}`}
                checked={autoAi}
                disabled={automationM.isPending || !autoSync}
                onCheckedChange={(v) => {
                  setAutoAi(v);
                  automationM.mutate({ autoAiModeration: v });
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              {isPaused ? (
                <>
                  <div className="text-xs text-amber-600">
                    {t("social.account_details.automation.paused_until", {
                      time: pausedUntil!.toLocaleString(),
                    })}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={automationM.isPending}
                    onClick={() => automationM.mutate({ syncPausedUntil: null })}
                  >
                    <PlayCircle className="mr-2 h-4 w-4" />
                    {t("social.account_details.automation.resume")}
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground">
                    {t("social.account_details.automation.pause_desc")}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={automationM.isPending}
                    onClick={() => {
                      const until = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
                      automationM.mutate({ syncPausedUntil: until });
                    }}
                  >
                    <PauseCircle className="mr-2 h-4 w-4" />
                    {t("social.account_details.automation.pause_24h")}
                  </Button>
                </>
              )}
            </div>
          </div>

          <Separator />

          {supportsImport && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">
                    {t("social.account_details.import_title")}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t("social.account_details.import_desc")}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => importM.mutate()}
                  disabled={importM.isPending}
                >
                  {importM.isPending ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-3.5 w-3.5" />
                  )}
                  {t("social.account_details.import_button")}
                </Button>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {t("social.account_details.import_auto_note")}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              {t("social.account_details.what_now")}
            </div>
            <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
              <li>{t("social.account_details.tip_ai_studio")}</li>
              <li>{t("social.account_details.tip_schedule")}</li>
              <li>{t("social.account_details.tip_inbox")}</li>
              {meta?.supportsMetrics && (
                <li>{t("social.account_details.tip_stats")}</li>
              )}
            </ul>
          </div>
        </div>


        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                {t("social.account_details.disconnect")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("social.account_details.disconnect_confirm_title")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("social.account_details.disconnect_confirm_desc", {
                    name: account.account_name,
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => disconnectM.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t("social.account_details.disconnect")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex gap-2">
            {externalUrl && (
              <Button asChild variant="outline" size="sm">
                <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t("social.account_details.open_external")}
                </a>
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t("common.close")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
