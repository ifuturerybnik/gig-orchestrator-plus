import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  ShieldCheck,
  ListChecks,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { SOCIAL_PLATFORMS, type SocialPlatformId } from "@/lib/social-platforms";
import { checkPlatformReadiness } from "@/lib/social.functions";

type Step = "intro" | "checklist" | "permissions" | "connect";

export function ConnectWizardDialog({
  platform,
  orgId: _orgId,
  open,
  onClose,
}: {
  platform: SocialPlatformId;
  orgId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const meta = SOCIAL_PLATFORMS[platform];
  const [step, setStep] = useState<Step>("intro");
  const [checklist, setChecklist] = useState<boolean[]>([false, false, false]);

  const checkFn = useServerFn(checkPlatformReadiness);
  const readinessQ = useQuery({
    queryKey: ["platform-readiness", platform],
    queryFn: () => checkFn({ data: { platform } }),
  });

  const steps: Step[] = ["intro", "checklist", "permissions", "connect"];
  const currentIdx = steps.indexOf(step);

  const allChecked = checklist.every(Boolean);

  const handleConnect = () => {
    if (!readinessQ.data?.hasClientId) {
      toast.warning(t("social.wizard.not_ready_toast"));
      return;
    }
    toast.info(t("social.wizard.oauth_redirect_coming_soon"));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`h-6 w-6 rounded ${meta.brandColor}`} />
            {t("social.wizard.title", { platform: t(`social.platforms.${platform}.name`) })}
          </DialogTitle>
          <DialogDescription>
            {t("social.wizard.step_indicator", {
              current: currentIdx + 1,
              total: steps.length,
            })}
          </DialogDescription>
        </DialogHeader>

        {step === "intro" && (
          <div className="space-y-4">
            <div>
              <h4 className="mb-2 text-sm font-semibold">{t("social.wizard.what_you_get")}</h4>
              <ul className="space-y-1.5 text-sm">
                {(
                  t(`social.platforms.${platform}.benefits`, {
                    returnObjects: true,
                    defaultValue: [],
                  }) as string[]
                ).map((b, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">{t("social.wizard.limits")}</h4>
              <div className="flex flex-wrap gap-2">
                {meta.requiresAppReview && (
                  <Badge variant="secondary">
                    <Clock className="mr-1 h-3 w-3" />
                    {t("social.wizard.requires_app_review")}
                  </Badge>
                )}
                {meta.requiresPaidApi && (
                  <Badge variant="destructive">{t("social.wizard.requires_paid_api")}</Badge>
                )}
                {meta.maxTextLength && (
                  <Badge variant="outline">
                    {t("social.wizard.max_chars", { count: meta.maxTextLength })}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {step === "checklist" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("social.wizard.checklist_intro")}</p>
            {(
              t(`social.platforms.${platform}.checklist`, {
                returnObjects: true,
                defaultValue: [],
              }) as string[]
            )
              .slice(0, 3)
              .map((item, i) => (
                <label
                  key={i}
                  className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={checklist[i] ?? false}
                    onCheckedChange={(c) => {
                      const next = [...checklist];
                      next[i] = c === true;
                      setChecklist(next);
                    }}
                  />
                  <span className="text-sm">{item}</span>
                </label>
              ))}
          </div>
        )}

        {step === "permissions" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <p className="text-sm">{t("social.wizard.permissions_intro")}</p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider">
                {t("social.wizard.scopes_requested")}
              </h4>
              <div className="space-y-1.5">
                {meta.scopes.map((s) => (
                  <div key={s} className="flex items-start gap-2 text-xs">
                    <ListChecks className="mt-0.5 h-3 w-3 text-muted-foreground" />
                    <code className="rounded bg-background px-1.5 py-0.5">{s}</code>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("social.wizard.permissions_explanation")}
            </p>
          </div>
        )}

        {step === "connect" && (
          <div className="space-y-4">
            {readinessQ.data?.hasClientId ? (
              <>
                <p className="text-sm">{t("social.wizard.ready_to_connect")}</p>
                <Button onClick={handleConnect} className="w-full" size="lg">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t("social.wizard.continue_to_provider", {
                    platform: t(`social.platforms.${platform}.name`),
                  })}
                </Button>
              </>
            ) : (
              <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
                <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-100">
                  <Clock className="h-4 w-4" />
                  {t("social.wizard.not_ready_title")}
                </div>
                <p className="text-amber-900 dark:text-amber-200">
                  {t("social.wizard.not_ready_body", { envKey: readinessQ.data?.envKey })}
                </p>
                <Separator />
                <div className="text-xs text-amber-800 dark:text-amber-300">
                  <strong>{t("social.wizard.for_admin")}:</strong>{" "}
                  {t("social.wizard.for_admin_body", {
                    envKey: readinessQ.data?.envKey,
                    platform: t(`social.platforms.${platform}.name`),
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              if (currentIdx === 0) onClose();
              else setStep(steps[currentIdx - 1]);
            }}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {currentIdx === 0 ? t("common.cancel") : t("common.back")}
          </Button>
          {currentIdx < steps.length - 1 ? (
            <Button
              onClick={() => setStep(steps[currentIdx + 1])}
              disabled={step === "checklist" && !allChecked}
            >
              {t("common.next")}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose}>
              {t("common.close")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
