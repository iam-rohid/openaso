import { CalendarIcon, EyeIcon, PlusIcon, StarIcon } from "lucide-react";
import { Fragment } from "react";
import { AppIcon } from "@/components/shared/app-icon";
import { AppLinksMenu } from "@/components/shared/app-links-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { compactNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RouterOutputs } from "@/trpc/react";

export type RankedApp = RouterOutputs["keywords"]["ranking"]["apps"][number];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Marks where the keyword appears in `text`: the whole phrase strongly, any of its
 * words on their own more softly. Matches whole words only, ignoring case.
 */
function Highlight({ text, term }: { text: string; term: string }) {
  const phrase = term.trim().toLowerCase();
  const words = [...new Set(phrase.split(/\s+/).filter(Boolean))];
  if (words.length === 0) return text;

  const alternatives = [...new Set([phrase, ...words])].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(${alternatives.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}])`,
    "giu",
  );
  return text.split(pattern).map((part, i) =>
    i % 2 === 0 ? (
      <Fragment key={i}>{part}</Fragment>
    ) : (
      <mark
        key={i}
        className={cn(
          "rounded-[3px] px-0.5 text-inherit",
          part.toLowerCase() === phrase ? "bg-amber-400/40" : "bg-amber-400/15",
        )}
      >
        {part}
      </mark>
    ),
  );
}

const releaseFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

/** One app in a keyword's App Store ranking, with hover actions to dig into it or track it. */
export function RankedAppRow({
  app,
  term,
  country,
  highlighted = false,
  isTracked,
  trackPending = false,
  onViewKeywords,
  onTrack,
}: {
  app: RankedApp;
  term: string;
  country: string;
  highlighted?: boolean;
  isTracked: boolean;
  trackPending?: boolean;
  onViewKeywords: () => void;
  onTrack: () => void;
}) {
  return (
    <div
      className={cn(
        "group hover:bg-muted/60 relative flex items-center gap-3 rounded-lg p-2",
        highlighted && "bg-primary/10 hover:bg-primary/15",
      )}
    >
      <AppIcon src={app.iconUrl} name={app.name} size={40} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="flex items-center gap-1.5 text-sm font-medium" title={app.name}>
          <span className="bg-foreground/10 text-muted-foreground shrink-0 rounded px-1.5 text-xs leading-5 tabular-nums">
            {app.position}
          </span>
          <span className="truncate">
            <Highlight text={app.name} term={term} />
          </span>
        </p>
        <p className="truncate text-xs" title={app.subtitle ?? undefined}>
          {app.subtitle ? (
            <Highlight text={app.subtitle} term={term} />
          ) : (
            <span className="text-muted-foreground/60 italic">No subtitle</span>
          )}
        </p>
        <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
          <StarIcon className="size-3 shrink-0 fill-current" />
          <span className="shrink-0 tabular-nums">
            {app.rating != null && app.ratingCount ? app.rating.toFixed(1) : "—"}
          </span>
          <span>·</span>
          <span className="shrink-0 tabular-nums">{compactNumber(app.ratingCount ?? 0)} ratings</span>
          {app.releaseDate && (
            <>
              <span>·</span>
              <CalendarIcon className="size-3 shrink-0" />
              <span className="shrink-0">{releaseFormat.format(new Date(app.releaseDate))}</span>
            </>
          )}
          {app.developer && (
            <>
              <span>·</span>
              <span className="truncate">{app.developer}</span>
            </>
          )}
        </p>
      </div>
      <div className="bg-muted absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-0.5 rounded-md opacity-0 shadow-sm transition-opacity group-hover:opacity-100 has-[[data-state=open]]:opacity-100">
        {!highlighted && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={onViewKeywords}>
                <EyeIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View keywords</TooltipContent>
          </Tooltip>
        )}
        {!isTracked && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" disabled={trackPending} onClick={onTrack}>
                <PlusIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add to My Apps</TooltipContent>
          </Tooltip>
        )}
        <AppLinksMenu appId={app.id} country={country} storeUrl={app.storeUrl} />
      </div>
    </div>
  );
}
