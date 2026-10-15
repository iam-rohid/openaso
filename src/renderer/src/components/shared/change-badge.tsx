import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** "±0", "▲3", "▼2" style delta. Positive = improvement. */
export function ChangeBadge({ value, className }: { value: number | null; className?: string }) {
  if (value == null || value === 0) {
    return <span className={cn("text-muted-foreground tabular-nums", className)}>±0</span>;
  }
  const up = value > 0;
  const Icon = up ? ArrowUpIcon : ArrowDownIcon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 tabular-nums font-medium",
        up ? "text-emerald-500" : "text-rose-500",
        className,
      )}
    >
      <Icon className="size-3" />
      {Math.abs(value)}
    </span>
  );
}
