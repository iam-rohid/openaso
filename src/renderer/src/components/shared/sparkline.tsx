import { cn } from "@/lib/utils";

/** A rank chart spans at least this many positions, so moving one place reads as a small step. */
const MIN_RANK_SPAN = 4;

/**
 * Minimal SVG sparkline over evenly spaced points.
 * - `rank`: App Store positions. Better (lower) plots higher, on a log scale, so moves
 *   near the top count for more than moves far down. Null points are unranked and sit
 *   at the bottom.
 * - `score`: 0–100 values on a fixed scale, so small wobbles stay small.
 * Undefined points are gaps (no data that day), drawn as a muted dashed line: flat from
 * the left edge to the first point, and bridging gaps between points. Days after the
 * last point stay empty, so stale data doesn't look current.
 */
export function Sparkline({
  values,
  variant,
  width = 88,
  height = 22,
  className,
}: {
  values: (number | null | undefined)[];
  variant: "rank" | "score";
  width?: number;
  height?: number;
  className?: string;
}) {
  const pad = 2;
  const known = values.filter((v) => v !== undefined).length;
  const bottom = height - pad;
  if (values.length < 2 || known === 0) {
    return (
      <svg width={width} height={height} className={cn("text-muted-foreground/40", className)}>
        <line x1={0} x2={width} y1={height / 2} y2={height / 2} stroke="currentColor" strokeWidth={1.25} />
      </svg>
    );
  }

  const toY = variant === "rank" ? rankScale(values, pad, height) : (v: number) =>
    bottom - (Math.min(100, Math.max(0, v)) / 100) * (height - pad * 2);
  const points = values.map((v, i) => {
    if (v === undefined) return null;
    const x = (i / (values.length - 1)) * width;
    return [x, v === null ? bottom : toY(v)] as const;
  });

  // Solid runs of consecutive days, and dashed stretches over the gaps between them.
  let solid = "";
  let dashed = "";
  let prev: readonly [number, number] | null = null;
  for (const [i, p] of points.entries()) {
    if (!p) continue;
    if (!prev) {
      if (p[0] > 0) dashed += `M0,${p[1].toFixed(1)}H${p[0].toFixed(1)}`;
      solid += `M${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    } else if (!points[i - 1]) {
      dashed += `M${prev[0].toFixed(1)},${prev[1].toFixed(1)}L${p[0].toFixed(1)},${p[1].toFixed(1)}`;
      solid += `M${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    } else {
      solid += `L${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    }
    prev = p;
  }

  return (
    <svg width={width} height={height} className={cn("text-primary overflow-visible", className)}>
      <path
        d={dashed}
        fill="none"
        className="text-muted-foreground/40"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeDasharray="2 2"
        strokeLinejoin="round"
      />
      <path d={solid} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
      {prev && <circle cx={prev[0]} cy={prev[1]} r={2} fill="currentColor" />}
    </svg>
  );
}

/** Log-scaled y for positions, best at the top, spanning at least MIN_RANK_SPAN positions. */
function rankScale(values: (number | null | undefined)[], pad: number, height: number) {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return () => height - pad;
  let best = Math.min(...nums);
  let worst = Math.max(...nums);
  if (worst - best < MIN_RANK_SPAN) {
    best = Math.max(1, Math.round((best + worst) / 2 - MIN_RANK_SPAN / 2));
    worst = best + MIN_RANK_SPAN;
  }
  const lo = Math.log(best);
  const span = Math.log(worst) - lo;
  // Keep ranked points a little above the bottom, where unranked days sit.
  const top = pad;
  const floor = height - pad * 2.5;
  return (v: number) => top + ((Math.log(v) - lo) / span) * (floor - top);
}
