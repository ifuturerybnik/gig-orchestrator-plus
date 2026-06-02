import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute(
  "/_authenticated/organizations/$orgId/ai-studio",
)({
  component: AiStudioPage,
});

function AiStudioPage() {
  const { t } = useTranslation();
  const { orgId } = Route.useParams();
  void orgId;
  return (
    <div className="container mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">
            {t("organizations.sidebar.ai_studio")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("organizations.ai_studio.subtitle", {
              defaultValue:
                "Twórz wpisy raz i publikuj je we wszystkich kanałach — social media oraz strony WWW.",
            })}
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            {t("organizations.ai_studio.coming_soon", {
              defaultValue: "Wkrótce",
            })}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("organizations.ai_studio.placeholder", {
            defaultValue:
              "Tu pojawi się uniwersalny generator treści (AI) z eksportem do Facebook, Instagram, TikTok, X, LinkedIn, YouTube oraz na stronę WWW (Aktualności, Wydarzenia, Galeria).",
          })}
        </CardContent>
      </Card>
    </div>
  );
}
