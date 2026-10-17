/** How far back a position trend compares. Every delta on a page uses the same window. */
export const TREND_WINDOWS = ["1d", "7d", "30d"] as const;
export type TrendWindow = (typeof TREND_WINDOWS)[number];
export const DEFAULT_TREND_WINDOW: TrendWindow = "7d";
export const TREND_WINDOW_DAYS: Record<TrendWindow, number> = { "1d": 1, "7d": 7, "30d": 30 };

/**
 * A keyword's position change over a window, comparing its latest daily point with
 * the one closest to N days before it.
 * - up / down / same: ranked at both ends; `delta` is positive when the app moved up.
 * - new / lost: entered or dropped out of the results.
 * - unranked: not in the results at either end.
 * - none: no point far enough back to compare with.
 */
export type Trend = {
  state: "up" | "down" | "same" | "new" | "lost" | "unranked" | "none";
  delta: number | null;
  currentAt: Date | null;
  baselineAt: Date | null;
  /** The keyword is younger than the window, so the baseline is its first point. */
  sinceStart: boolean;
};

/** One point per local calendar day, oldest first; null where the keyword wasn't checked that day. */
export type DailyPosition = { at: Date; position: number | null } | null;

/** Sort order for the Trend column: New above every climb, Lost below every drop. */
export function trendSortValue(trend: Trend): number | undefined {
  switch (trend.state) {
    case "new":
      return 100_000;
    case "lost":
      return -100_000;
    case "none":
      return undefined;
    case "unranked":
      return 0;
    default:
      return trend.delta ?? 0;
  }
}
