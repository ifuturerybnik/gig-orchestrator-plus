import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getMyConsentStatus,
  acceptCurrentConsents,
} from "@/lib/consents.functions";

/**
 * Blokujący modal pojawiający się gdy wersja Regulaminu / Polityki uległa
 * zmianie od ostatniej akceptacji. User musi zaakceptować, żeby kontynuować
 * korzystanie z aplikacji (brak prawa odmowy = wymagane do działania konta —
 * ale może zamiast tego usunąć konto w panelu profilu).
 */
export function ConsentGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(getMyConsentStatus);
  const acceptFn = useServerFn(acceptCurrentConsents);

  const [termsOk, setTermsOk] = useState(false);
  const [privacyOk, setPrivacyOk] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["my-consent-status"],
    queryFn: () => fetchStatus(),
    staleTime: 60_000,
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptFn(),
    onSuccess: () => {
      toast.success(t("consent_update.success"));
      queryClient.invalidateQueries({ queryKey: ["my-consent-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const needs = statusQuery.data?.needsAcceptance ?? false;

  // Dopóki ładujemy status — renderujemy children (nie blokujemy).
  // Modal pojawi się dopiero gdy faktycznie wykryjemy nieaktualne zgody.
  return (
    <>
      {children}
      <Dialog open={needs}>
        <DialogContent
          className="sm:max-w-lg"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{t("consent_update.title")}</DialogTitle>
            <DialogDescription>{t("consent_update.subtitle")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-accent">
              <Checkbox
                checked={termsOk}
                onCheckedChange={(c) => setTermsOk(c === true)}
                className="mt-0.5"
              />
              <span className="text-sm">
                {t("consent_update.accept_terms")}{" "}
                <Link
                  to="/terms"
                  target="_blank"
                  className="underline text-primary"
                >
                  {t("footer.terms")}
                </Link>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-accent">
              <Checkbox
                checked={privacyOk}
                onCheckedChange={(c) => setPrivacyOk(c === true)}
                className="mt-0.5"
              />
              <span className="text-sm">
                {t("consent_update.accept_privacy")}{" "}
                <Link
                  to="/privacy"
                  target="_blank"
                  className="underline text-primary"
                >
                  {t("footer.privacy")}
                </Link>
              </span>
            </label>
          </div>

          <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            {t("consent_update.alternative")}
          </p>

          <DialogFooter>
            <Button
              onClick={() => acceptMutation.mutate()}
              disabled={!termsOk || !privacyOk || acceptMutation.isPending}
            >
              {acceptMutation.isPending
                ? t("common.loading")
                : t("consent_update.button")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
