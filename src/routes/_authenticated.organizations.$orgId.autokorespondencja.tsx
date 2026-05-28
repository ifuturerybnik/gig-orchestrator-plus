import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute(
  "/_authenticated/organizations/$orgId/autokorespondencja",
)({
  component: OrgAutokorespondencjaPage,
});

function OrgAutokorespondencjaPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">
          {t("correspondence.autokor.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("correspondence.autokor.subtitle")}
        </p>
      </div>
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {t("correspondence.autokor.coming_soon")}
      </div>
    </div>
  );
}
