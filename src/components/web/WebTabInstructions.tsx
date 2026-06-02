import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type Tab = "news" | "events" | "gallery" | "integration" | "webhooks";

type Section = {
  heading: string;
  items?: string[];
  body?: string;
};

type Content = {
  title: string;
  intro: string;
  sections: Section[];
};

/**
 * Łopatologiczna instrukcja w nagłówku każdej zakładki modułu Web.
 * Treść po stronie i18n (klucze web.instructions.<tab>.*).
 */
export function WebTabInstructions({ tab }: { tab: Tab }) {
  const { t } = useTranslation();
  const content = t(`web.instructions.${tab}`, { returnObjects: true }) as Content;
  if (!content || typeof content !== "object" || !content.title) return null;

  return (
    <Accordion type="single" collapsible className="mb-4">
      <AccordionItem
        value="instr"
        className="rounded-md border border-border bg-muted/30 px-4"
      >
        <AccordionTrigger className="text-sm font-medium hover:no-underline">
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            {content.title}
          </span>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pb-4 pt-2 text-sm leading-relaxed">
          {content.intro && (
            <p className="text-muted-foreground">{content.intro}</p>
          )}
          {Array.isArray(content.sections) &&
            content.sections.map((s, i) => (
              <div key={i} className="space-y-1">
                <p className="font-semibold">{s.heading}</p>
                {s.body && <p className="text-muted-foreground">{s.body}</p>}
                {Array.isArray(s.items) && s.items.length > 0 && (
                  <ul className="ml-5 list-disc space-y-1 text-muted-foreground">
                    {s.items.map((it, j) => (
                      <li key={j}>{it}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
