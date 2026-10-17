import type { ColumnFiltersState } from "@tanstack/react-table";
import { ListFilterIcon } from "lucide-react";
import { Fragment, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { cn } from "@/lib/utils";
import { RANK_COLUMN_IDS } from "./keyword-columns";

type Range = [number, number];

/**
 * Range filters over the numeric keyword columns. Ids match the column ids, and each column's
 * `filterFn` reads the bounds. Open-ended bounds (`openMin`/`openMax`) mean a thumb at that edge
 * also keeps everything past it, e.g. positions beyond 200 or New/Lost in the Trend column.
 */
const FILTERS = [
  { id: "popularity", label: "Popularity", min: 0, max: 100 },
  { id: "difficulty", label: "Difficulty", min: 0, max: 100 },
  { id: "position", label: "Position", min: 1, max: 200, openMax: true },
  { id: "trend", label: "Change", min: -100, max: 100, openMin: true, openMax: true },
] as const satisfies { id: string; label: string; min: number; max: number; openMin?: boolean; openMax?: boolean }[];

type FilterDef = (typeof FILTERS)[number] & { openMin?: boolean; openMax?: boolean };
type FilterId = FilterDef["id"];

export type KeywordFilters = Record<FilterId, { enabled: boolean; range: Range }>;

/** A column filter's value: inclusive bounds, either of which may be open. */
export type RangeFilterValue = { min?: number; max?: number };

export const DEFAULT_KEYWORD_FILTERS = Object.fromEntries(
  FILTERS.map((f) => [f.id, { enabled: false, range: [f.min, f.max] }]),
) as KeywordFilters;

/** Shared by every app's keyword table, so filters stay applied when switching apps and across restarts. */
export function useKeywordFilters() {
  const [stored, setFilters] = useLocalStorageState<Partial<KeywordFilters>>(
    "openaso:kw-filters",
    DEFAULT_KEYWORD_FILTERS,
  );
  // Fill in filters added since the value was saved.
  const filters = useMemo(() => ({ ...DEFAULT_KEYWORD_FILTERS, ...stored }), [stored]);
  return [filters, setFilters] as const;
}

/** The enabled filters as TanStack column filters; rank filters are dropped when those columns don't apply. */
export function toColumnFilters(filters: KeywordFilters, { hideRankColumns = false } = {}): ColumnFiltersState {
  return (FILTERS as readonly FilterDef[])
    .filter((f) => filters[f.id].enabled && !(hideRankColumns && RANK_COLUMN_IDS.includes(f.id)))
    .map((f) => {
      const [lo, hi] = filters[f.id].range;
      const value: RangeFilterValue = {
        min: f.openMin && lo === f.min ? undefined : lo,
        max: f.openMax && hi === f.max ? undefined : hi,
      };
      return { id: f.id, value };
    });
}

function formatBound(f: FilterDef, value: number) {
  if (f.openMin && value === f.min) return `≤${value}`;
  if (f.openMax && value === f.max) return `${value}+`;
  return String(value);
}

/** Header popover with a range slider per numeric column, à la Astro. */
export function KeywordFiltersMenu({
  filters,
  onChange,
  hideRankColumns = false,
}: {
  filters: KeywordFilters;
  onChange: (filters: KeywordFilters) => void;
  hideRankColumns?: boolean;
}) {
  const visible = (FILTERS as readonly FilterDef[]).filter((f) => !hideRankColumns || !RANK_COLUMN_IDS.includes(f.id));
  const active = visible.filter((f) => filters[f.id].enabled).length;
  const set = (id: FilterId, next: Partial<KeywordFilters[FilterId]>) =>
    onChange({ ...filters, [id]: { ...filters[id], ...next } });

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="relative">
              <ListFilterIcon />
              {active > 0 && (
                <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 z-10 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums">
                  {active}
                </span>
              )}
              <span className="sr-only">Filters</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Filters</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <p className="px-4 pt-3 pb-1 text-sm font-semibold">Filters</p>
        {visible.map((f) => {
          const { enabled, range } = filters[f.id];
          const checkboxId = `kw-filter-${f.id}`;
          return (
            <Fragment key={f.id}>
              <div className="flex flex-col gap-3 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={checkboxId}>
                    <Checkbox id={checkboxId} checked={enabled} onCheckedChange={(v) => set(f.id, { enabled: !!v })} />
                    {f.label}
                  </Label>
                  <span className={cn("text-xs tabular-nums", enabled ? "text-primary" : "text-muted-foreground")}>
                    {formatBound(f, range[0])} – {formatBound(f, range[1])}
                  </span>
                </div>
                <Slider
                  min={f.min}
                  max={f.max}
                  step={1}
                  minStepsBetweenThumbs={0}
                  value={range}
                  aria-label={f.label}
                  className={cn(!enabled && "opacity-60")}
                  // Moving a slider switches its filter on, so there's no separate step to apply it.
                  onValueChange={(v) => set(f.id, { range: v as Range, enabled: true })}
                />
                <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
                  <span>{f.min}</span>
                  <span>{f.max}</span>
                </div>
              </div>
              <Separator />
            </Fragment>
          );
        })}
        <div className="flex justify-center p-2">
          <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_KEYWORD_FILTERS)}>
            Reset
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
