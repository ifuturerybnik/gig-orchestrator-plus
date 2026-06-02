import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute(
  "/_authenticated/organizations/$orgId/ai-studio",
)({
  component: WebPage,
});

function WebPage() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Globe className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">
            {t("organizations.sidebar.web")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("organizations.web.subtitle", {
              defaultValue:
                "Zarządzaj stronami internetowymi tej organizacji — wkrótce.",
            })}
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            {t("organizations.web.coming_soon", {
              defaultValue: "Wkrótce",
            })}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("organizations.web.placeholder", {
            defaultValue:
              "Tu pojawi się moduł zarządzania stronami WWW (kreator, integracje, SEO, domeny).",
          })}
        </CardContent>
      </Card>
    </div>
  );
}
