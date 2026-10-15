import { scoreTone } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Number + thin progress bar, colour-coded like Astro's popularity/difficulty. */
export function ScoreBar({
  value,
  inverse = false,
  className,
}: {
  value: number | null | undefined;
  inverse?: boolean;
  className?: string;
}) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  return (
    <div className={cn("flex w-full items-center gap-2.5", className)}>
      <span className="w-7 text-right tabular-nums">{value}</span>
      <div className="bg-muted h-1.5 min-w-12 flex-1 overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full transition-[width]", scoreTone(value, inverse))}
          style={{ width: `${Math.max(3, value)}%` }}
        />
      </div>
    </div>
  );
}
