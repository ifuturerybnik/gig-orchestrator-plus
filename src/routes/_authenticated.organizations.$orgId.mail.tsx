import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/organizations/$orgId/mail")({
  component: OrgMailPage,
});

function OrgMailPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("correspondence.mail.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("correspondence.mail.subtitle")}
        </p>
      </div>
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {t("correspondence.mail.coming_soon")}
      </div>
    </div>
  );
}
