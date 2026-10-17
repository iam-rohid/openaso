import { cn } from "@/lib/utils";

/**
 * Minimal SVG sparkline over evenly spaced points. `invert` flips the axis so lower
 * values (better ranks) plot higher. Null points are drawn at the bottom (unranked);
 * undefined points are gaps (no data that day), which break the line.
 */
export function Sparkline({
  values,
  invert = false,
  width = 88,
  height = 22,
  className,
}: {
  values: (number | null | undefined)[];
  invert?: boolean;
  width?: number;
  height?: number;
  className?: string;
}) {
  const nums = values.filter((v): v is number => v != null);
  const known = values.filter((v) => v !== undefined).length;
  if (values.length < 2 || known < 2 || nums.length === 0) {
    return (
      <svg width={width} height={height} className={cn("text-muted-foreground/40", className)}>
        <line x1={0} x2={width} y1={height / 2} y2={height / 2} stroke="currentColor" strokeWidth={1.25} />
      </svg>
    );
  }

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const pad = 2;
  const points = values.map((v, i) => {
    if (v === undefined) return null;
    const x = (i / (values.length - 1)) * width;
    if (v === null) return [x, height - pad] as const;
    let t = (v - min) / span;
    if (invert) t = 1 - t;
    if (max === min) t = 0.5;
    return [x, height - pad - t * (height - pad * 2)] as const;
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
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
      {isolated.map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r={1} fill="currentColor" />
      ))}
      {last && <circle cx={last[0]} cy={last[1]} r={2} fill="currentColor" />}
    </svg>
  );
}
