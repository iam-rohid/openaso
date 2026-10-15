import { cn } from "@/lib/utils";

/**
 * Minimal SVG sparkline. `invert` flips the axis so lower values (better ranks)
 * plot higher. Null points are drawn at the bottom (unranked).
 */
export function Sparkline({
  values,
  invert = false,
  width = 88,
  height = 22,
  className,
}: {
  values: (number | null)[];
  invert?: boolean;
  width?: number;
  height?: number;
  className?: string;
}) {
  const nums = values.filter((v): v is number => v != null);
  if (values.length < 2 || nums.length === 0) {
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
    const x = (i / (values.length - 1)) * width;
    if (v == null) return [x, height - pad] as const;
    let t = (v - min) / span;
    if (invert) t = 1 - t;
    if (max === min) t = 0.5;
    return [x, height - pad - t * (height - pad * 2)] as const;
  });
  const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = points[points.length - 1];

  return (
    <svg width={width} height={height} className={cn("text-primary overflow-visible", className)}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={2} fill="currentColor" />
    </svg>
  );
}
