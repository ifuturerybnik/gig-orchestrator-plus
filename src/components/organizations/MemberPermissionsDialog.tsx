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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  ORG_MODULES,
  ORG_MODULE_GROUPS,
  type BudgetPermissionMode,
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

  useEffect(() => {
    if (!open) return;
    if (query.data) {
      const p = query.data.permissions;
      if (p) {
        setIsOrgAdmin(p.is_org_admin);
        setModules(new Set(p.modules));
        setBudgetMode(p.budget_mode);
      } else {
        // brak wpisu = traktujemy jak org admin (kompatybilność)
        setIsOrgAdmin(true);
        setModules(new Set());
        setBudgetMode("full");
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

  const toggleModule = (id: OrgModuleId, checked: boolean) => {
    setModules((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const configurable = ORG_MODULES.filter((m) => m.configurable);
  const grouped = ORG_MODULE_GROUPS.map((g) => ({
    group: g,
    items: configurable.filter((m) => m.group === g.id),
  }));
  const ungrouped = configurable.filter((m) => !m.group);

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
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-md border border-border bg-card p-3">
              <div className="space-y-0.5">
                <Label htmlFor="is_org_admin" className="cursor-pointer">
                  {t("organizations.permissions.org_admin")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("organizations.permissions.org_admin_help")}
                </p>
              </div>
              <Switch
                id="is_org_admin"
                checked={isOrgAdmin}
                onCheckedChange={setIsOrgAdmin}
              />
            </div>

            <div className={isOrgAdmin ? "opacity-50 pointer-events-none" : ""}>
              <p className="mb-2 text-sm font-medium">
                {t("organizations.permissions.selective_modules")}
              </p>

              <div className="space-y-3">
                {ungrouped.map((m) => (
                  <ModuleRow
                    key={m.id}
                    moduleId={m.id}
                    labelKey={m.labelKey}
                    checked={modules.has(m.id)}
                    onCheckedChange={(c) => toggleModule(m.id, c)}
                    extra={
                      m.id === "budget" && modules.has("budget") ? (
                        <BudgetSubChoice
                          value={budgetMode}
                          onChange={setBudgetMode}
                        />
                      ) : null
                    }
                  />
                ))}

                {grouped.map(({ group, items }) =>
                  items.length === 0 ? null : (
                    <div key={group.id} className="rounded-md border border-border bg-card/40 p-2">
                      <p className="px-1 pb-1 text-xs font-semibold uppercase text-muted-foreground">
                        {t(group.labelKey)}
                      </p>
                      <div className="space-y-2 pl-2">
                        {items.map((m) => (
                          <ModuleRow
                            key={m.id}
                            moduleId={m.id}
                            labelKey={m.labelKey}
                            checked={modules.has(m.id)}
                            onCheckedChange={(c) => toggleModule(m.id, c)}
                          />
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
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

function ModuleRow({
  moduleId,
  labelKey,
  checked,
  onCheckedChange,
  extra,
}: {
  moduleId: OrgModuleId;
  labelKey: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  extra?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Checkbox
          id={`mod-${moduleId}`}
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(Boolean(v))}
        />
        <Label htmlFor={`mod-${moduleId}`} className="cursor-pointer">
          {t(labelKey)}
        </Label>
      </div>
      {extra && <div className="ml-6">{extra}</div>}
    </div>
  );
}

function BudgetSubChoice({
  value,
  onChange,
}: {
  value: BudgetPermissionMode;
  onChange: (v: BudgetPermissionMode) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-md border border-border bg-background/50 p-2">
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as BudgetPermissionMode)}
        className="space-y-1"
      >
        <div className="flex items-start gap-2">
          <RadioGroupItem id="bm-full" value="full" className="mt-0.5" />
          <Label htmlFor="bm-full" className="cursor-pointer text-sm font-normal">
            {t("organizations.permissions.budget.full")}
          </Label>
        </div>
        <div className="flex items-start gap-2">
          <RadioGroupItem id="bm-un" value="unrealized_only" className="mt-0.5" />
          <Label htmlFor="bm-un" className="cursor-pointer text-sm font-normal">
            {t("organizations.permissions.budget.unrealized_only")}
          </Label>
        </div>
      </RadioGroup>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("organizations.permissions.budget.help")}
      </p>
    </div>
  );
}
