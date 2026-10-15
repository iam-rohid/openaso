import { formatDistanceToNowStrict } from "date-fns";

export function timeAgo(date: Date | string | null | undefined) {
  if (!date) return "Never";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Date.now() - d.getTime() < 60_000) return "Just now";
  return `${formatDistanceToNowStrict(d)} ago`;
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
export function compactNumber(n: number | null | undefined) {
  return n == null ? "—" : compact.format(n);
}

/** Bucketed colour for a 0–100 score. `inverse` = high is bad (difficulty). */
export function scoreTone(value: number, inverse = false) {
  const v = inverse ? 100 - value : value;
  if (v >= 70) return "bg-emerald-500";
  if (v >= 45) return "bg-lime-500";
  if (v >= 25) return "bg-amber-400";
  if (v >= 12) return "bg-orange-500";
  return "bg-rose-500";
}
