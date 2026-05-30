import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  Eye,
  ClipboardList,
  Clock,
  CheckCircle2,
  ListChecks,
} from "lucide-react";
import type { SocialPlatformId } from "@/lib/social-platforms";

interface PlatformInfoDialogProps {
  platform: SocialPlatformId;
  open: boolean;
  onClose: () => void;
}

/**
 * Dialog z informacjami o integracji konkretnej platformy SM.
 * Treść w pełni przez i18next: social.platforms.<pid>.info.{description,how_it_looks,what_to_arrange,time_estimate}
 * plus reuse istniejących benefits/checklist.
 */
export function PlatformInfoDialog({ platform, open, onClose }: PlatformInfoDialogProps) {
  const { t } = useTranslation();

  const name = t(`social.platforms.${platform}.name`);
  const tagline = t(`social.platforms.${platform}.tagline`);
  const description = t(`social.platforms.${platform}.info.description`);
  const howItLooks = t(`social.platforms.${platform}.info.how_it_looks`);
  const whatToArrange = t(`social.platforms.${platform}.info.what_to_arrange`, {
    returnObjects: true,
  }) as string[];
  const timeEstimate = t(`social.platforms.${platform}.info.time_estimate`);

  const benefits = t(`social.platforms.${platform}.benefits`, {
    returnObjects: true,
  }) as string[];
  const checklist = t(`social.platforms.${platform}.checklist`, {
    returnObjects: true,
  }) as string[];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t("social.info_dialog.title", { platform: name })}
          </DialogTitle>
          <DialogDescription>{tagline}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-5">
            <Section
              icon={<Sparkles className="h-4 w-4 text-amber-600" />}
              title={t("social.info_dialog.sections.description")}
            >
              <p className="text-sm text-muted-foreground">{description}</p>
            </Section>

            <Section
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              title={t("social.info_dialog.sections.benefits")}
            >
              <ul className="space-y-1.5 text-sm">
                {Array.isArray(benefits) &&
                  benefits.map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span>{b}</span>
                    </li>
                  ))}
              </ul>
            </Section>

            <Section
              icon={<Eye className="h-4 w-4 text-sky-600" />}
              title={t("social.info_dialog.sections.how_it_looks")}
            >
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {howItLooks}
              </p>
            </Section>

            <Section
              icon={<ClipboardList className="h-4 w-4 text-violet-600" />}
              title={t("social.info_dialog.sections.what_to_arrange")}
            >
              <ul className="space-y-1.5 text-sm">
                {Array.isArray(whatToArrange) &&
                  whatToArrange.map((w, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-0.5 text-violet-600">•</span>
                      <span>{w}</span>
                    </li>
                  ))}
              </ul>
            </Section>

            <Section
              icon={<ListChecks className="h-4 w-4 text-slate-600" />}
              title={t("social.info_dialog.sections.checklist")}
            >
              <ul className="space-y-1.5 text-sm">
                {Array.isArray(checklist) &&
                  checklist.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-0.5 text-slate-500">☐</span>
                      <span>{c}</span>
                    </li>
                  ))}
              </ul>
            </Section>

            <Section
              icon={<Clock className="h-4 w-4 text-orange-600" />}
              title={t("social.info_dialog.sections.time_estimate")}
            >
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {timeEstimate}
              </p>
            </Section>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("social.info_dialog.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}
