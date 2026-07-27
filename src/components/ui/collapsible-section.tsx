import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /**
   * When true, no outer border/background is rendered — useful when the child
   * already provides its own card/frame. The summary becomes a slim toggle bar.
   */
  bare?: boolean;
  className?: string;
}

/**
 * A simple, accessible collapsible section built on <details>/<summary>.
 * Collapsed by default. Click the header (or chevron) to expand.
 */
export function CollapsibleSection({
  title,
  description,
  children,
  defaultOpen = false,
  bare = false,
  className,
}: Props) {
  return (
    <details
      className={cn(
        "group",
        !bare && "rounded-md border border-border bg-card",
        "[&>summary::-webkit-details-marker]:hidden",
        className,
      )}
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between gap-3 select-none",
          bare
            ? "rounded-md border border-border bg-card px-4 py-3 hover:bg-accent/40"
            : "p-4 hover:bg-accent/30 rounded-md",
        )}
      >
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground sm:text-lg">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              {description}
            </p>
          ) : null}
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className={cn(bare ? "mt-3" : "border-t border-border p-4")}>
        {children}
      </div>
    </details>
  );
}
