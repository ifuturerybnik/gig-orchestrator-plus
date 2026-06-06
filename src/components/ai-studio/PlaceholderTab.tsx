import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

export function PlaceholderTab({
  titleKey,
  descKey,
}: {
  titleKey: string;
  descKey: string;
}) {
  const { t } = useTranslation();
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          {t(titleKey)}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {t(descKey)}
        <p className="mt-3 text-xs">{t("ai_studio.coming_soon")}</p>
      </CardContent>
    </Card>
  );
}
