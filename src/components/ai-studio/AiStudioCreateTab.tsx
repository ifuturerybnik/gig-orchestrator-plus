import { useTranslation } from "react-i18next";
import { Share2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AiStudioTab } from "@/components/social/AiStudioTab";
import { WebQuickPublishCard } from "./WebQuickPublishCard";

/**
 * Tworzenie multi-kanał:
 *  - sekcja SM = istniejący kreator postów social (AiStudioTab)
 *  - sekcja WWW = szybka publikacja aktualności (WebQuickPublishCard)
 * Pełna edycja wydarzeń/galerii WWW pozostaje w module Web (link w opisie).
 */
export function AiStudioCreateTab({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-8">
      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Share2 className="h-4 w-4 text-primary" />
            {t("ai_studio.create.sm_title")}
          </CardTitle>
          <CardDescription>{t("ai_studio.create.sm_subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <AiStudioTab orgId={orgId} />
        </CardContent>
      </Card>

      <WebQuickPublishCard orgId={orgId} />
    </div>
  );
}
