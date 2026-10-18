import { TREND_WINDOW_DAYS, type DailyPosition, type Trend, type TrendWindow } from "@shared/trends";

/** A keyword with its daily positions and its trend over the chosen window. */
type SummaryRow = { history: DailyPosition[]; trend: Trend };

export const RANK_BUCKETS = [
  { id: "top10", label: "1–10" },
  { id: "top50", label: "11–50" },
  { id: "rest", label: "51+" },
  { id: "unranked", label: "Not ranked" },
] as const;
export type RankBucket = (typeof RANK_BUCKETS)[number]["id"];
export type BucketCounts = Record<RankBucket, number>;

function bucketOf(position: number | null): RankBucket {
  if (position == null) return "unranked";
  if (position <= 10) return "top10";
  if (position <= 50) return "top50";
  return "rest";
}

const emptyCounts = (): BucketCounts => ({ top10: 0, top50: 0, rest: 0, unranked: 0 });

/**
 * How many keywords sat in each bucket on each of the history's days. A keyword missing
 * a day keeps its last known position, so the bars don't dip on days the app was closed;
 * before its first point it isn't counted at all.
 */
export function dailyBucketCounts(rows: SummaryRow[]) {
  const length = rows[0]?.history.length ?? 0;
  const days = Array.from({ length }, () => ({ counts: emptyCounts(), known: 0 }));
  for (const row of rows) {
    let last: number | null | undefined;
    row.history.forEach((point, i) => {
      if (point) last = point.position;
      if (last === undefined) return;
      days[i].counts[bucketOf(last)]++;
      days[i].known++;
    });
  }
  return days;
}

/** Headline counts (cumulative: Top 50 includes the Top 10) now and `window` ago. */
export function summarize<T extends SummaryRow>(rows: T[], window: TrendWindow) {
  const days = dailyBucketCounts(rows);
  const headline = (c: BucketCounts | undefined) =>
    c && { top10: c.top10, top50: c.top10 + c.top50, ranked: c.top10 + c.top50 + c.rest };
  const now = headline(days.at(-1)?.counts);
  const then = days.at(-1 - TREND_WINDOW_DAYS[window]);
  // No delta when nothing was known that far back.
  const before = then && then.known > 0 ? headline(then.counts) : undefined;

  const byDelta = (a: T, b: T) => (b.trend.delta ?? 0) - (a.trend.delta ?? 0);
  const gainers = rows.filter((r) => r.trend.state === "up").sort(byDelta);
  const losers = rows.filter((r) => r.trend.state === "down").sort(byDelta).reverse();
  return {
    days,
    now,
    before,
    gainers,
    losers,
    entered: rows.filter((r) => r.trend.state === "new"),
    dropped: rows.filter((r) => r.trend.state === "lost"),
  };
}
