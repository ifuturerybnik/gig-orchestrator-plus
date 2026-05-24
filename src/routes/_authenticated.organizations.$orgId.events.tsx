import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CalendarDays } from "lucide-react";

export const Route = createFileRoute(
  "/_authenticated/organizations/$orgId/events",
)({
  component: OrganizationEventsPage,
});

function OrganizationEventsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {t("organizations.events.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("organizations.events.subtitle")}
        </p>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-card p-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CalendarDays className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-foreground">
          {t("organizations.events.coming_soon")}
        </p>
        <p className="max-w-md text-sm text-muted-foreground">
          {t("organizations.events.empty")}
        </p>
      </div>
    </div>
  );
}
