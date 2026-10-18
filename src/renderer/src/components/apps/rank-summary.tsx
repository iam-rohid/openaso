import { format } from "date-fns";
import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon } from "lucide-react";
import { useMemo } from "react";
import { TREND_WINDOWS, type TrendWindow } from "@shared/trends";
import type { KeywordRow } from "@/components/keywords/keyword-table-features";
import { describeTrend, TrendBadge } from "@/components/shared/trend-badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { RANK_BUCKETS, summarize, type RankBucket } from "@shared/trend-summary";
import { cn } from "@/lib/utils";

/** One hue, darkest for the best bucket; dark mode steps the other way so the best stays most prominent. */
const BUCKET_COLORS: Record<RankBucket, string> = {
  top10: "bg-indigo-600 dark:bg-indigo-400",
  top50: "bg-indigo-400 dark:bg-indigo-600",
  rest: "bg-indigo-200 dark:bg-indigo-800",
  unranked: "bg-muted-foreground/20",
};

const MOVERS_SHOWN = 3;

/**
 * The app's overall ranking at a glance: how many keywords are in the top 10 / top 50 /
 * ranked and how that changed over the selected window, with a 30-day chart and the
 * biggest movers one click away. The window picked here drives every trend on the page.
 */
export function RankSummary({
  rows,
  window,
  onWindowChange,
  onOpenKeyword,
}: {
  rows: KeywordRow[];
  window: TrendWindow;
  onWindowChange: (window: TrendWindow) => void;
  onOpenKeyword: (row: KeywordRow) => void;
}) {
  const summary = useMemo(() => summarize(rows, window), [rows, window]);
  const [expanded, setExpanded] = useLocalStorageState("openaso:rank-summary-open", false);
  const { now, before, gainers, losers, entered, dropped } = summary;

  return (
    <div className="border-b px-4 py-2">
      <div className="flex items-center gap-5 text-sm">
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          spacing={0}
          value={window}
          onValueChange={(v) => v && onWindowChange(v as TrendWindow)}
          aria-label="Trend window"
        >
          {TREND_WINDOWS.map((w) => (
            <ToggleGroupItem key={w} value={w} className="px-2.5 text-xs">
              {w}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Headline label="Top 10" value={now?.top10} previous={before?.top10} />
        <Headline label="Top 50" value={now?.top50} previous={before?.top50} />
        <Headline label="Ranked" value={now?.ranked} previous={before?.ranked} />

        <div className="text-muted-foreground ml-auto flex items-center gap-3 text-xs tabular-nums max-lg:hidden">
          <span>
            <span className="text-emerald-500">{gainers.length}</span> up
          </span>
          <span>
            <span className="text-rose-500">{losers.length}</span> down
          </span>
          <span>
            <span className="text-emerald-500">{entered.length}</span> new
          </span>
          <span>
            <span className="text-rose-500">{dropped.length}</span> lost
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground max-lg:ml-auto"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? "Hide" : "Movers & history"}
          <ChevronDownIcon className={cn("transition-transform", expanded && "rotate-180")} />
        </Button>
      </div>

      {expanded && (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-6 pt-3 pb-2">
          <BucketChart days={summary.days} />
          <div className="grid grid-cols-4 gap-4">
            <MoverList title="Biggest gains" rows={gainers} onOpen={onOpenKeyword} />
            <MoverList title="Biggest drops" rows={losers} onOpen={onOpenKeyword} />
            <MoverList title="New" rows={entered} onOpen={onOpenKeyword} />
            <MoverList title="Lost" rows={dropped} onOpen={onOpenKeyword} />
          </div>
        </div>
      )}
    </div>
  );
}

function Headline({ label, value, previous }: { label: string; value?: number; previous?: number }) {
  const delta = value != null && previous != null ? value - previous : null;
  return (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-semibold tabular-nums">{value ?? "—"}</span>
      {delta != null && delta !== 0 && (
        <span
          className={cn(
            "inline-flex items-center text-xs font-medium tabular-nums",
            delta > 0 ? "text-emerald-500" : "text-rose-500",
          )}
        >
          {delta > 0 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />}
          {Math.abs(delta)}
        </span>
      )}
    </div>
  );
}

function MoverList({
  title,
  rows,
  onOpen,
}: {
  title: string;
  rows: KeywordRow[];
  onOpen: (row: KeywordRow) => void;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-muted-foreground text-xs">{title}</p>
      {rows.length === 0 && <p className="text-muted-foreground/60 text-xs">None</p>}
      {rows.slice(0, MOVERS_SHOWN).map((row) => (
        <Tooltip key={row.id}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="hover:text-primary flex w-full min-w-0 items-center justify-between gap-2 text-left text-xs"
              onClick={() => onOpen(row)}
            >
              <span className="truncate">{row.term}</span>
              <TrendBadge trend={row.trend} className="shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {describeTrend(row.trend)} · now {row.position == null ? "not ranked" : `#${row.position}`}
          </TooltipContent>
        </Tooltip>
      ))}
      {rows.length > MOVERS_SHOWN && (
        <p className="text-muted-foreground text-xs">+{rows.length - MOVERS_SHOWN} more</p>
      )}
    </div>
  );
}

/** Daily stacked bars of keywords per ranking bucket over the last 30 days. */
function BucketChart({ days }: { days: ReturnType<typeof summarize>["days"] }) {
  const max = Math.max(1, ...days.map((d) => d.known));
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {RANK_BUCKETS.map((b) => (
          <span key={b.id} className="inline-flex items-center gap-1">
            <span className={cn("size-2 rounded-[2px]", BUCKET_COLORS[b.id])} />
            {b.label}
          </span>
        ))}
      </div>
      <div className="flex h-20 items-end gap-[2px]" role="img" aria-label="Keywords per ranking bucket, daily">
        {days.map((day, i) => (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              {/* Full-height hit target, so thin or empty bars are still easy to hover. */}
              <div className="hover:bg-muted/60 flex h-full min-w-0 flex-1 flex-col-reverse gap-[2px] rounded-[3px]">
                {day.known === 0 ? (
                  <div className="bg-border h-px" />
                ) : (
                  RANK_BUCKETS.filter((b) => day.counts[b.id] > 0).map((b, j, shown) => (
                    <div
                      key={b.id}
                      className={cn(BUCKET_COLORS[b.id], j === shown.length - 1 && "rounded-t-[3px]")}
                      style={{ height: `${(day.counts[b.id] / max) * 100}%` }}
                    />
                  ))
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{dayLabel(days, i)}</p>
              {day.known === 0 ? (
                <p>No data</p>
              ) : (
                RANK_BUCKETS.map((b) => (
                  <p key={b.id} className="flex justify-between gap-4 tabular-nums">
                    <span>{b.label}</span>
                    <span>{day.counts[b.id]}</span>
                  </p>
                ))
              )}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="text-muted-foreground flex justify-between text-[10px]">
        <span>{dayLabel(days, 0)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function dayLabel(days: unknown[], index: number) {
  const date = new Date();
  date.setDate(date.getDate() - (days.length - 1 - index));
  return index === days.length - 1 ? "Today" : format(date, "MMM d");
}
