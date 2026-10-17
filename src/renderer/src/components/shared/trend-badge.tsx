import { format } from "date-fns";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import type { Trend } from "@shared/trends";
import { cn } from "@/lib/utils";

/** "▲3", "▼2", "±0", "New", "Lost" or "–". Dimmed when it only covers the time since tracking started. */
export function TrendBadge({ trend, className }: { trend: Trend; className?: string }) {
  const dim = trend.sinceStart && "opacity-60";
  switch (trend.state) {
    case "up":
    case "down": {
      const Icon = trend.state === "up" ? ArrowUpIcon : ArrowDownIcon;
      return (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 font-medium tabular-nums",
            trend.state === "up" ? "text-emerald-500" : "text-rose-500",
            dim,
            className,
          )}
        >
          <Icon className="size-3" />
          {Math.abs(trend.delta ?? 0)}
        </span>
      );
    }
    case "new":
    case "lost":
      return (
        <span
          className={cn(
            "font-medium",
            trend.state === "new" ? "text-emerald-500" : "text-rose-500",
            dim,
            className,
          )}
        >
          {trend.state === "new" ? "New" : "Lost"}
        </span>
      );
    case "same":
      return <span className={cn("text-muted-foreground tabular-nums", dim, className)}>±0</span>;
    default:
      return <span className={cn("text-muted-foreground", className)}>–</span>;
  }
}

/** Tooltip text naming the dates a trend compares. */
export function describeTrend(trend: Trend) {
  if (trend.state === "none" || !trend.baselineAt) return "Not enough history yet";
  const since = trend.sinceStart
    ? `since tracking started on ${format(trend.baselineAt, "MMM d")}`
    : `vs ${format(trend.baselineAt, "MMM d")}`;
  switch (trend.state) {
    case "up":
      return `Up ${trend.delta} ${since}`;
    case "down":
      return `Down ${Math.abs(trend.delta ?? 0)} ${since}`;
    case "same":
      return `No change ${since}`;
    case "new":
      return `Entered the ranking ${since}`;
    case "lost":
      return `Dropped out of the ranking ${since}`;
    default:
      return `Not ranked, ${since}`;
  }
}
