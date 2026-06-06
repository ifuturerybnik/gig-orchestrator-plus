import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OrgPermissionsFields } from "@/components/organizations/OrgPermissionsFields";
import {
  type AiStudioPermissionMode,
  type BudgetPermissionMode,
  type EventsPermissionMode,
  type OrgModuleId,
} from "@/lib/org-modules";
import {
  getMemberPermissions,
  setMemberPermissions,
} from "@/lib/organizations.functions";

interface Props {
  memberId: string | null;
  memberLabel: string;
  organizationId: string;
  onClose: () => void;
}

export function MemberPermissionsDialog({
  memberId,
  memberLabel,
  organizationId,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fetchFn = useServerFn(getMemberPermissions);
  const saveFn = useServerFn(setMemberPermissions);

  const open = memberId !== null;

  const query = useQuery({
    enabled: open,
    queryKey: ["member-permissions", memberId],
    queryFn: () => fetchFn({ data: { memberId: memberId! } }),
  });

  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [modules, setModules] = useState<Set<OrgModuleId>>(new Set());
  const [budgetMode, setBudgetMode] = useState<BudgetPermissionMode>("full");
  const [eventsMode, setEventsMode] = useState<EventsPermissionMode>("full");
  const [aiStudioMode, setAiStudioMode] = useState<AiStudioPermissionMode>("full");

  useEffect(() => {
    if (!open) return;
    if (query.data) {
      const p = query.data.permissions;
      if (p) {
        setIsOrgAdmin(p.is_org_admin);
        setModules(new Set(p.modules));
        setBudgetMode(p.budget_mode);
        setEventsMode((p as { events_mode?: EventsPermissionMode }).events_mode ?? "full");
        setAiStudioMode(
          (p as { ai_studio_mode?: AiStudioPermissionMode }).ai_studio_mode ?? "full",
        );
      } else {
        setIsOrgAdmin(true);
        setModules(new Set());
        setBudgetMode("full");
        setEventsMode("full");
        setAiStudioMode("full");
      }
    }
  }, [open, query.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          memberId: memberId!,
          isOrgAdmin,
          modules: Array.from(modules),
          budgetMode,
          eventsMode,
          aiStudioMode,
        },
      }),
    onSuccess: () => {
      toast.success(t("organizations.permissions.saved"));
      queryClient.invalidateQueries({ queryKey: ["organization", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["member-permissions", memberId] });
      queryClient.invalidateQueries({ queryKey: ["my-org-permissions", organizationId] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("organizations.permissions.title")}</DialogTitle>
          <DialogDescription>
            {t("organizations.permissions.subtitle", { name: memberLabel })}
          </DialogDescription>
        </DialogHeader>

        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <OrgPermissionsFields
            isOrgAdmin={isOrgAdmin}
            onIsOrgAdminChange={setIsOrgAdmin}
            modules={modules}
            onModulesChange={setModules}
            budgetMode={budgetMode}
            onBudgetModeChange={setBudgetMode}
            eventsMode={eventsMode}
            onEventsModeChange={setEventsMode}
            aiStudioMode={aiStudioMode}
            onAiStudioModeChange={setAiStudioMode}
            fieldIdPrefix={`member-permissions-${memberId ?? "new"}`}
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || query.isLoading}
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
