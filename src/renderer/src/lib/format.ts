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

/**
 * Bucketed colour for a 0–100 score. Popularity: higher is better (red → green).
 * Difficulty (`inverse`): lower is better (green → red).
 */
export function scoreTone(value: number, inverse = false) {
  if (inverse) {
    if (value < 20) return "bg-emerald-500";
    if (value < 40) return "bg-lime-500";
    if (value < 60) return "bg-amber-400";
    if (value < 80) return "bg-orange-500";
    return "bg-rose-500";
  }
  if (value >= 60) return "bg-emerald-500";
  if (value >= 40) return "bg-lime-500";
  if (value >= 20) return "bg-amber-400";
  if (value >= 10) return "bg-orange-500";
  return "bg-rose-500";
}
