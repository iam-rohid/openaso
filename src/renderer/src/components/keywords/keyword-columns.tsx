import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, RefreshCwIcon } from "lucide-react";
import { AppIcon } from "@/components/shared/app-icon";
import { ChangeBadge } from "@/components/shared/change-badge";
import { ScoreBar } from "@/components/shared/score-bar";
import { Sparkline } from "@/components/shared/sparkline";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { countryFlag } from "@shared/countries";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { copyKeyword } from "./keyword-actions-menu";
import { NotesCell } from "./notes-cell";
import type { KeywordRow, KeywordTableActions, KeywordTableFeatures } from "./keyword-table-features";

export type { KeywordRow, KeywordTableActions };

function SortHeader({
  label,
  column,
  className,
}: {
  label: string;
  column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (desc?: boolean) => void };
  className?: string;
}) {
  const sorted = column.getIsSorted();
  const Icon = sorted === "asc" ? ArrowUpIcon : sorted === "desc" ? ArrowDownIcon : ArrowUpDownIcon;
  return (
    <button
      type="button"
      className={cn(
        "hover:text-foreground -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-left",
        sorted && "text-foreground",
        className,
      )}
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {label}
      <Icon className={cn("size-3", !sorted && "opacity-40")} />
    </button>
  );
}

const nullsLast = { sortUndefined: "last" as const };

/** Columns about the app's own ranking; meaningless for temporary apps, which aren't on the App Store. */
export const RANK_COLUMN_IDS = ["position", "trend"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous column values
export const keywordColumns: ColumnDef<KeywordTableFeatures, KeywordRow, any>[] = [
  {
    id: "select",
    size: 36,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all"
        checked={table.getIsAllRowsSelected() || (table.getIsSomeRowsSelected() && "indeterminate")}
        onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label="Select row"
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        onClick={(e) => e.stopPropagation()}
      />
    ),
  },
  {
    accessorKey: "term",
    meta: { label: "Keyword" },
    size: 220,
    header: ({ column }) => <SortHeader label="Keyword" column={column} />,
    cell: ({ row, table }) => (
      <div className="flex min-w-0 items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="hover:text-primary min-w-0 cursor-copy truncate text-left font-medium"
              onClick={() => copyKeyword(row.original.term)}
            >
              {row.original.term}
            </button>
          </TooltipTrigger>
          <TooltipContent>Click to copy</TooltipContent>
        </Tooltip>
        {!row.original.tracked && table.options.meta?.actions.editable && (
          <span className="text-muted-foreground border-border rounded border px-1 text-[10px] uppercase">
            untracked
          </span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "notes",
    meta: { label: "Notes" },
    size: 160,
    enableSorting: false,
    header: "Notes",
    cell: ({ row, table }) => {
      const actions = table.options.meta!.actions;
      if (!actions.editable || !row.original.tracked) {
        return <span className="text-muted-foreground truncate">{row.original.notes}</span>;
      }
      return <NotesCell appId={actions.appId} keywordId={row.original.id} notes={row.original.notes} />;
    },
  },
  {
    id: "lastUpdate",
    accessorFn: (r) => (r.lastFetchedAt ? new Date(r.lastFetchedAt).getTime() : undefined),
    ...nullsLast,
    meta: { label: "Last update" },
    size: 120,
    header: ({ column }) => <SortHeader label="Last update" column={column} />,
    cell: ({ row, table }) => {
      const refreshing = table.options.meta?.actions.refreshingIds.has(row.original.id);
      return (
        <span className="text-muted-foreground inline-flex items-center gap-1.5 whitespace-nowrap">
          {refreshing ? (
            <RefreshCwIcon className="size-3 animate-spin" />
          ) : (
            row.original.stale && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="size-1.5 rounded-full bg-amber-400" />
                </TooltipTrigger>
                <TooltipContent>Cached data is older than the refresh window</TooltipContent>
              </Tooltip>
            )
          )}
          {timeAgo(row.original.lastFetchedAt)}
        </span>
      );
    },
  },
  {
    accessorKey: "country",
    meta: { label: "Store" },
    size: 72,
    enableSorting: false,
    header: "Store",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="text-base leading-none">{countryFlag(row.original.country)}</span>
        {row.original.country}
      </span>
    ),
  },
  {
    id: "popularity",
    accessorFn: (r) => r.popularity ?? undefined,
    ...nullsLast,
    meta: { label: "Popularity" },
    size: 120,
    header: ({ column }) => <SortHeader label="Popularity" column={column} />,
    cell: ({ row }) => <ScoreBar value={row.original.popularity} />,
  },
  {
    id: "difficulty",
    accessorFn: (r) => r.difficulty ?? undefined,
    ...nullsLast,
    meta: { label: "Difficulty" },
    size: 120,
    header: ({ column }) => <SortHeader label="Difficulty" column={column} />,
    cell: ({ row }) => <ScoreBar value={row.original.difficulty} inverse />,
  },
  {
    id: "position",
    accessorFn: (r) => r.position ?? undefined,
    ...nullsLast,
    meta: { label: "Position" },
    size: 84,
    header: ({ column }) => <SortHeader label="Position" column={column} />,
    cell: ({ row, table }) => (
      <button
        type="button"
        className={cn(
          "tabular-nums hover:underline",
          row.original.position == null && "text-muted-foreground",
          row.original.position != null && row.original.position <= 10 && "font-semibold text-emerald-500",
        )}
        onClick={() => table.options.meta?.actions.onOpenRanking(row.original)}
      >
        # {row.original.position ?? "-"}
      </button>
    ),
  },
  {
    id: "trend",
    accessorFn: (r) => r.positionChange ?? undefined,
    ...nullsLast,
    meta: { label: "Trend" },
    size: 140,
    header: ({ column }) => <SortHeader label="Trend" column={column} />,
    cell: ({ row }) => {
      const { history, positionChange } = row.original;
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <ChangeBadge value={positionChange} className="w-8 text-xs" />
              <Sparkline
                values={history.map((h) => h.position)}
                invert
                className={cn(
                  positionChange != null && positionChange > 0 && "text-emerald-500",
                  positionChange != null && positionChange < 0 && "text-rose-500",
                )}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {history.length < 2
              ? "Trend appears after the keyword is refreshed again"
              : `Position over the last ${history.length} updates`}
          </TooltipContent>
        </Tooltip>
      );
    },
  },
  {
    id: "results",
    accessorFn: (r) => r.resultCount ?? undefined,
    ...nullsLast,
    meta: { label: "Results" },
    size: 84,
    header: ({ column }) => <SortHeader label="Results" column={column} />,
    cell: ({ row }) => <span className="tabular-nums">{row.original.resultCount ?? "—"}</span>,
  },
  {
    id: "apps",
    meta: { label: "Apps in Ranking" },
    size: 230,
    enableSorting: false,
    header: "Apps in Ranking",
    cell: ({ row, table }) => {
      const { topApps, resultCount } = row.original;
      const rest = Math.max(0, (resultCount ?? 0) - topApps.length);
      return (
        <button
          type="button"
          className="group flex items-center gap-1.5"
          onClick={() => table.options.meta?.actions.onOpenRanking(row.original)}
        >
          {topApps.map((app) => (
            <Tooltip key={app.id}>
              <TooltipTrigger asChild>
                <span className="transition-transform group-hover:scale-105">
                  <AppIcon
                    src={app.iconUrl}
                    name={app.name}
                    size={26}
                    className={cn(app.id === table.options.meta?.actions.appId && "ring-primary ring-2")}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>{app.name}</TooltipContent>
            </Tooltip>
          ))}
          {rest > 0 && <span className="text-muted-foreground ml-1 text-xs">+{rest}</span>}
          {topApps.length === 0 && <span className="text-muted-foreground text-xs">No results</span>}
        </button>
      );
    },
  },
  {
    // Empty, unsized column that absorbs leftover width so the other columns keep their sizes.
    id: "filler",
    // Counted as zero in the table's min width, so narrow windows don't scroll to reveal empty space.
    size: 0,
    minSize: 0,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    header: () => null,
    cell: () => null,
  },
];
