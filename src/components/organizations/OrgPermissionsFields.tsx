import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  ORG_MODULES,
  ORG_MODULE_GROUPS,
  type BudgetPermissionMode,
  type EventsPermissionMode,
  type OrgModuleId,
} from "@/lib/org-modules";

interface OrgPermissionsFieldsProps {
  isOrgAdmin: boolean;
  onIsOrgAdminChange: (value: boolean) => void;
  modules: Set<OrgModuleId>;
  onModulesChange: Dispatch<SetStateAction<Set<OrgModuleId>>>;
  budgetMode: BudgetPermissionMode;
  onBudgetModeChange: (value: BudgetPermissionMode) => void;
  eventsMode: EventsPermissionMode;
  onEventsModeChange: (value: EventsPermissionMode) => void;
  fieldIdPrefix: string;
}

export function OrgPermissionsFields({
  isOrgAdmin,
  onIsOrgAdminChange,
  modules,
  onModulesChange,
  budgetMode,
  onBudgetModeChange,
  eventsMode,
  onEventsModeChange,
  fieldIdPrefix,
}: OrgPermissionsFieldsProps) {
  const { t } = useTranslation();

  const toggleModule = (id: OrgModuleId, checked: boolean) => {
    onModulesChange((prev) => {
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

  const extraFor = (id: OrgModuleId): ReactNode => {
    if (id === "budget" && modules.has("budget")) {
      return (
        <BudgetSubChoice
          fieldIdPrefix={`${fieldIdPrefix}-budget`}
          value={budgetMode}
          onChange={onBudgetModeChange}
        />
      );
    }
    if (id === "events" && modules.has("events")) {
      return (
        <EventsSubChoice
          fieldIdPrefix={`${fieldIdPrefix}-events`}
          value={eventsMode}
          onChange={onEventsModeChange}
        />
      );
    }
    return null;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-md border border-border bg-card p-3">
        <div className="space-y-0.5">
          <Label htmlFor={`${fieldIdPrefix}-is-org-admin`} className="cursor-pointer">
            {t("organizations.permissions.org_admin")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("organizations.permissions.org_admin_help")}
          </p>
        </div>
        <Switch
          id={`${fieldIdPrefix}-is-org-admin`}
          checked={isOrgAdmin}
          onCheckedChange={onIsOrgAdminChange}
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
              fieldId={`${fieldIdPrefix}-mod-${m.id}`}
              moduleId={m.id}
              labelKey={m.labelKey}
              checked={modules.has(m.id)}
              onCheckedChange={(checked) => toggleModule(m.id, checked)}
              extra={extraFor(m.id)}
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
                      fieldId={`${fieldIdPrefix}-mod-${m.id}`}
                      moduleId={m.id}
                      labelKey={m.labelKey}
                      checked={modules.has(m.id)}
                      onCheckedChange={(checked) => toggleModule(m.id, checked)}
                      extra={extraFor(m.id)}
                    />
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function ModuleRow({
  fieldId,
  labelKey,
  checked,
  onCheckedChange,
  extra,
}: {
  fieldId: string;
  moduleId: OrgModuleId;
  labelKey: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  extra?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Checkbox
          id={fieldId}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(Boolean(value))}
        />
        <Label htmlFor={fieldId} className="cursor-pointer">
          {t(labelKey)}
        </Label>
      </div>
      {extra && <div className="ml-6">{extra}</div>}
    </div>
  );
}

function BudgetSubChoice({
  fieldIdPrefix,
  value,
  onChange,
}: {
  fieldIdPrefix: string;
  value: BudgetPermissionMode;
  onChange: (value: BudgetPermissionMode) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-md border border-border bg-background/50 p-2">
      <RadioGroup
        value={value}
        onValueChange={(nextValue) => onChange(nextValue as BudgetPermissionMode)}
        className="space-y-1"
      >
        <div className="flex items-start gap-2">
          <RadioGroupItem id={`${fieldIdPrefix}-full`} value="full" className="mt-0.5" />
          <Label htmlFor={`${fieldIdPrefix}-full`} className="cursor-pointer text-sm font-normal">
            {t("organizations.permissions.budget.full")}
          </Label>
        </div>
        <div className="flex items-start gap-2">
          <RadioGroupItem
            id={`${fieldIdPrefix}-unrealized-only`}
            value="unrealized_only"
            className="mt-0.5"
          />
          <Label
            htmlFor={`${fieldIdPrefix}-unrealized-only`}
            className="cursor-pointer text-sm font-normal"
          >
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

function EventsSubChoice({
  fieldIdPrefix,
  value,
  onChange,
}: {
  fieldIdPrefix: string;
  value: EventsPermissionMode;
  onChange: (value: EventsPermissionMode) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-md border border-border bg-background/50 p-2">
      <RadioGroup
        value={value}
        onValueChange={(nextValue) => onChange(nextValue as EventsPermissionMode)}
        className="space-y-1"
      >
        {(["full", "view_only", "view_confirmed_only"] as const).map((opt) => (
          <div key={opt} className="flex items-start gap-2">
            <RadioGroupItem
              id={`${fieldIdPrefix}-${opt}`}
              value={opt}
              className="mt-0.5"
            />
            <Label
              htmlFor={`${fieldIdPrefix}-${opt}`}
              className="cursor-pointer text-sm font-normal"
            >
              {t(`organizations.permissions.events.${opt}`)}
            </Label>
          </div>
        ))}
      </RadioGroup>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("organizations.permissions.events.help")}
      </p>
    </div>
  );
}
