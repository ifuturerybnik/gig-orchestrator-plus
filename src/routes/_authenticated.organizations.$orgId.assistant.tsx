import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MessageCircle } from "lucide-react";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";

export const Route = createFileRoute(
  "/_authenticated/organizations/$orgId/assistant",
)({
  component: AssistantPage,
});

function AssistantPage() {
  const { t } = useTranslation();
  const { orgId } = Route.useParams();

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("organizations.assistant.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("organizations.assistant.subtitle")}
          </p>
        </div>
      </header>

      <AssistantPanel orgId={orgId} />
    </div>
  );
}
