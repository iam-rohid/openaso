import { cn } from "@/lib/utils";

/** A rank chart spans at least this many positions, so moving one place reads as a small step. */
const MIN_RANK_SPAN = 20;

/**
 * Minimal SVG sparkline over evenly spaced points, drawn on a faint track spanning the
 * whole range so a short history reads as "starts here" rather than as a stray mark.
 * - `rank`: App Store positions. Better (lower) plots higher, on a log scale, so moves
 *   near the top count for more than moves far down. Null points are unranked and sit
 *   at the bottom.
 * - `score`: 0–100 values on a fixed scale, so small wobbles stay small.
 * Undefined points are gaps (no data that day), which break the line.
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

  let d = "";
  let penDown = false;
  for (const p of points) {
    if (!p) {
      penDown = false;
      continue;
    }
    d += `${penDown ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    penDown = true;
  }
  // A point with gaps on both sides has no line, so mark it with a dot.
  const isolated = points.filter((p, i): p is NonNullable<typeof p> => !!p && !points[i - 1] && !points[i + 1]);
  const last = points.findLast((p) => p != null);

  return (
    <svg width={width} height={height} className={cn("text-primary overflow-visible", className)}>
      <line
        x1={0}
        x2={width}
        y1={bottom}
        y2={bottom}
        className="text-muted-foreground/25"
        stroke="currentColor"
        strokeWidth={1}
        strokeDasharray="2 3"
      />
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
      {isolated.map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r={1.25} fill="currentColor" />
      ))}
      {last && <circle cx={last[0]} cy={last[1]} r={2} fill="currentColor" />}
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
