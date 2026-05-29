import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  createVacation,
  updateVacation,
  deleteVacation,
} from "@/lib/vacations.functions";

export interface VacationInitial {
  id: string;
  start_date: string;
  end_date: string;
  description: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  initial?: VacationInitial | null;
  initialDate?: string | null;
}

function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function VacationDialog({
  open,
  onOpenChange,
  organizationId,
  initial,
  initialDate,
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const createFn = useServerFn(createVacation);
  const updateFn = useServerFn(updateVacation);
  const deleteFn = useServerFn(deleteVacation);

  const [range, setRange] = useState<{ from?: Date; to?: Date } | undefined>();
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setRange({ from: parseISO(initial.start_date), to: parseISO(initial.end_date) });
      setDescription(initial.description ?? "");
    } else if (initialDate) {
      const d = parseISO(initialDate);
      setRange({ from: d, to: d });
      setDescription("");
    } else {
      setRange(undefined);
      setDescription("");
    }
  }, [open, initial, initialDate]);

  const handleSave = async () => {
    if (!range?.from) {
      toast.error(t("organizations.vacations.errors.range_required"));
      return;
    }
    const start = format(range.from, "yyyy-MM-dd");
    const end = format(range.to ?? range.from, "yyyy-MM-dd");
    setSaving(true);
    try {
      if (initial) {
        await updateFn({
          data: {
            vacationId: initial.id,
            organizationId,
            startDate: start,
            endDate: end,
            description: description.trim() || null,
          },
        });
        toast.success(t("organizations.vacations.toasts.updated"));
      } else {
        await createFn({
          data: {
            organizationId,
            startDate: start,
            endDate: end,
            description: description.trim() || null,
          },
        });
        toast.success(t("organizations.vacations.toasts.created"));
      }
      await qc.invalidateQueries({ queryKey: ["vacations", organizationId] });
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initial) return;
    setDeleting(true);
    try {
      await deleteFn({ data: { organizationId, vacationId: initial.id } });
      toast.success(t("organizations.vacations.toasts.deleted"));
      await qc.invalidateQueries({ queryKey: ["vacations", organizationId] });
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {initial
                ? t("organizations.vacations.dialog.title_edit")
                : t("organizations.vacations.dialog.title")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("organizations.vacations.fields.range")}</Label>
              <div className="rounded-md border border-border p-2">
                <Calendar
                  mode="range"
                  selected={range as never}
                  onSelect={(r) => setRange(r as never)}
                  numberOfMonths={1}
                />
              </div>
              {range?.from && (
                <p className="text-xs text-muted-foreground">
                  {format(range.from, "yyyy-MM-dd")}
                  {range.to && range.to.getTime() !== range.from.getTime()
                    ? ` → ${format(range.to, "yyyy-MM-dd")}`
                    : ""}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="vacation-desc">
                {t("organizations.vacations.fields.description")}
              </Label>
              <Textarea
                id="vacation-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("organizations.vacations.fields.description_placeholder")}
                rows={3}
                maxLength={2000}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {initial && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setConfirmDelete(true)}
                  disabled={saving}
                >
                  {t("organizations.vacations.actions.delete")}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                {t("common.cancel")}
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {initial
                  ? t("organizations.vacations.dialog.submit_edit")
                  : t("organizations.vacations.dialog.submit")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(o) => !deleting && setConfirmDelete(o)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("organizations.vacations.actions.delete_confirm_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("organizations.vacations.actions.delete_confirm_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("organizations.vacations.actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
