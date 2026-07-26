import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  address?: string | null;
  name?: string | null;
  /** Additional key/value pairs shown inside the tooltip */
  extra?: Record<string, string | null | undefined>;
  className?: string;
  /** show name inline after the address (default) or below */
  layout?: "inline" | "stack";
  /** tone for the small name text */
  muted?: boolean;
};

/**
 * Renders an ADE (e-Doręczenia) address with a tiny entity name beside it.
 * Hovering the address shows a tooltip with the full details.
 */
export function AdeAddress({
  address,
  name,
  extra,
  className,
  layout = "inline",
  muted = true,
}: Props) {
  const addr = address?.trim() || "";
  const nm = name?.trim() || "";
  if (!addr && !nm) return <span className="text-muted-foreground">—</span>;

  const tooltipRows: [string, string][] = [];
  if (nm) tooltipRows.push(["Podmiot", nm]);
  if (addr) tooltipRows.push(["Adres e-Doręczeń", addr]);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      const val = (v ?? "").toString().trim();
      if (val) tooltipRows.push([k, val]);
    }
  }

  const addressEl = addr ? (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="font-mono cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
            tabIndex={0}
          >
            {addr}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm bg-popover text-popover-foreground border shadow-md">
          <div className="space-y-1">
            {tooltipRows.map(([k, v]) => (
              <div key={k} className="text-xs">
                <span className="text-muted-foreground">{k}: </span>
                <span className={k === "Adres e-Doręczeń" ? "font-mono break-all" : "break-words"}>
                  {v}
                </span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : null;

  const nameEl = nm ? (
    <span
      className={cn(
        "text-[10px] leading-none",
        muted ? "text-muted-foreground" : "text-foreground/80",
      )}
      title={nm}
    >
      {nm}
    </span>
  ) : null;

  if (layout === "stack") {
    return (
      <span className={cn("inline-flex flex-col gap-0.5 min-w-0 align-middle", className)}>
        {addressEl}
        {nameEl}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-baseline gap-1.5 min-w-0 flex-wrap", className)}>
      {addressEl}
      {nameEl}
    </span>
  );
}

export default AdeAddress;
