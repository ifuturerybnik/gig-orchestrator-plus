import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Wallet } from "lucide-react";

export const Route = createFileRoute(
  "/_authenticated/organizations/$orgId/budget",
)({
  component: OrganizationBudgetPage,
});

function OrganizationBudgetPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {t("organizations.budget.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("organizations.budget.subtitle")}
        </p>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-card p-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Wallet className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-foreground">
          {t("organizations.budget.coming_soon")}
        </p>
        <p className="max-w-md text-sm text-muted-foreground">
          {t("organizations.budget.empty")}
        </p>
      </div>
    </div>
  );
}
