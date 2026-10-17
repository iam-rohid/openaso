import {
  TREND_WINDOW_DAYS,
  TREND_WINDOWS,
  type DailyPosition,
  type Trend,
  type TrendWindow,
} from "@shared/trends";

/**
 * Trends are measured in local calendar days: a keyword gets one point per day (its
 * latest snapshot that day), however many times it was fetched, and days it wasn't
 * fetched are gaps rather than repeats of the day before.
 */

/** A baseline may come from this many days either side of the target day. */
const BASELINE_TOLERANCE_DAYS = 2;
/** Snapshots a trend can need: the longest window plus the tolerance. */
export const TREND_LOOKBACK_DAYS = Math.max(...Object.values(TREND_WINDOW_DAYS)) + BASELINE_TOLERANCE_DAYS;

const DAY_MS = 86_400_000;

/** Local calendar day as a day number, so days can be subtracted. */
export function localDay(date: Date) {
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60_000) / DAY_MS);
}

/** Local midnight `daysAgo` days before `now`. */
export function startOfLocalDay(now = new Date(), daysAgo = 0) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

type Point = { at: Date; position: number | null };
type DayPoint = Point & { day: number };

/** The latest point of each local day, oldest first. */
export function dailyPoints<T extends Point>(points: T[]): (T & { day: number })[] {
  const byDay = new Map<number, T & { day: number }>();
  for (const p of points) {
    const day = localDay(p.at);
    const kept = byDay.get(day);
    if (!kept || p.at > kept.at) byDay.set(day, { ...p, day });
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day);
}

function compare(baseline: DayPoint, current: DayPoint, sinceStart: boolean): Trend {
  const b = baseline.position;
  const c = current.position;
  const base = { currentAt: current.at, baselineAt: baseline.at, sinceStart };
  if (b == null && c == null) return { ...base, state: "unranked", delta: null };
  if (b == null) return { ...base, state: "new", delta: null };
  if (c == null) return { ...base, state: "lost", delta: null };
  const delta = b - c;
  return { ...base, state: delta > 0 ? "up" : delta < 0 ? "down" : "same", delta };
}

const NO_TREND: Trend = { state: "none", delta: null, currentAt: null, baselineAt: null, sinceStart: false };

/**
 * Change from the point closest to `windowDays` before the latest one (within the
 * tolerance, preferring the older point on a tie). A keyword younger than the window
 * is compared with its first point instead; an older one with a gap there has no trend.
 *
 * @param days one point per day, oldest first
 * @param firstDay the day of the keyword's first snapshot ever
 */
export function computeTrend(days: DayPoint[], windowDays: number, firstDay: number | null): Trend {
  const current = days.at(-1);
  if (!current) return NO_TREND;
  const target = current.day - windowDays;

  let baseline: DayPoint | undefined;
  for (const d of days) {
    if (d.day >= current.day) break;
    const distance = Math.abs(d.day - target);
    if (distance > BASELINE_TOLERANCE_DAYS) continue;
    // Days are ascending, so on a tie the older point is already kept.
    if (!baseline || distance < Math.abs(baseline.day - target)) baseline = d;
  }
  if (baseline) return compare(baseline, current, false);

  const first = days[0];
  const young = firstDay != null && firstDay > target + BASELINE_TOLERANCE_DAYS;
  if (young && first.day === firstDay && first.day < current.day) return compare(first, current, true);
  return NO_TREND;
}

export function computeTrends(days: DayPoint[], firstDay: number | null): Record<TrendWindow, Trend> {
  return Object.fromEntries(
    TREND_WINDOWS.map((w) => [w, computeTrend(days, TREND_WINDOW_DAYS[w], firstDay)]),
  ) as Record<TrendWindow, Trend>;
}

/** `length` days ending today, oldest first, with null for days without a point. */
export function dailySeries<T extends DayPoint>(days: T[], length: number, now = new Date()) {
  const today = localDay(now);
  const byDay = new Map(days.map((d) => [d.day, d]));
  return Array.from({ length }, (_, i) => byDay.get(today - (length - 1 - i)) ?? null);
}

/** Today and the 30 days before it, enough for the table's sparkline at any window; the page trims it. */
const POSITION_HISTORY_DAYS = TREND_WINDOW_DAYS["30d"] + 1;

export function positionHistory(days: DayPoint[], now = new Date()): DailyPosition[] {
  return dailySeries(days, POSITION_HISTORY_DAYS, now).map((d) =>
    d ? { at: d.at, position: d.position } : null,
  );
}
