import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount, exportMyData } from "@/lib/account.functions";

export function PrivacySection({ userEmail }: { userEmail?: string | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const exportFn = useServerFn(exportMyData);
  const deleteFn = useServerFn(deleteMyAccount);

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

  const onExport = async () => {
    setExporting(true);
    try {
      const data = await exportFn();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `concertivo-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("privacy.export.success"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setExporting(false);
    }
  };

  const onDelete = async () => {
    if (confirmEmail.trim().toLowerCase() !== (userEmail ?? "").toLowerCase()) {
      toast.error(t("privacy.delete.email_mismatch"));
      return;
    }
    setDeleting(true);
    try {
      await deleteFn();
      await supabase.auth.signOut();
      toast.success(t("privacy.delete.success"));
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="space-y-4 rounded-md border border-border bg-card p-4">
      <div>
        <h2 className="text-lg font-semibold">{t("privacy.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("privacy.subtitle")}</p>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{t("privacy.export.title")}</p>
          <p className="text-xs text-muted-foreground">{t("privacy.export.help")}</p>
        </div>
        <Button variant="outline" onClick={onExport} disabled={exporting}>
          {exporting ? t("common.loading") : t("privacy.export.button")}
        </Button>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{t("privacy.delete.title")}</p>
          <p className="text-xs text-muted-foreground">{t("privacy.delete.help")}</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">{t("privacy.delete.button")}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("privacy.delete.confirm_title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("privacy.delete.confirm_desc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="confirm_email">
                {t("privacy.delete.email_label", { email: userEmail ?? "" })}
              </Label>
              <Input
                id="confirm_email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={userEmail ?? ""}
                autoComplete="off"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void onDelete();
                }}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? t("common.loading") : t("privacy.delete.confirm_button")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
