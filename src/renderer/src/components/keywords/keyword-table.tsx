import { useTable, type RowSelectionState } from "@tanstack/react-table";
import { CopyIcon, RefreshCwIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { KeywordActionsMenuItems } from "./keyword-actions-menu";
import { keywordColumns, RANK_COLUMN_IDS } from "./keyword-columns";
import { useKeywordColumnSizing, useKeywordColumnVisibility, useKeywordSorting } from "./keyword-table-prefs";
import {
  keywordTableFeatures,
  type KeywordRow,
  type KeywordTableActions,
} from "./keyword-table-features";

const EMPTY: KeywordRow[] = [];

/** The filler column has no fixed width so it absorbs leftover space and the other columns keep their sizes. */
const FILL_COLUMN = "filler";

export function KeywordTable({
  data,
  isLoading,
  actions,
  emptyState,
  globalFilter,
  hideRankColumns = false,
}: {
  data: KeywordRow[] | undefined;
  isLoading: boolean;
  actions: KeywordTableActions;
  emptyState: React.ReactNode;
  /** Text filter over keyword terms and notes, controlled by the page. */
  globalFilter: string;
  /** Hide position/trend regardless of the saved column choice. */
  hideRankColumns?: boolean;
}) {
  const [sorting, setSorting] = useKeywordSorting();
  const [columnVisibility, setColumnVisibility] = useKeywordColumnVisibility();
  const [columnSizing, setColumnSizing] = useKeywordColumnSizing();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useTable({
    features: keywordTableFeatures,
    data: data ?? EMPTY,
    columns: keywordColumns,
    state: {
      sorting,
      columnVisibility: hideRankColumns
        ? { ...columnVisibility, ...Object.fromEntries(RANK_COLUMN_IDS.map((id) => [id, false])) }
        : columnVisibility,
      columnSizing,
      globalFilter,
      rowSelection,
    },
    defaultColumn: { minSize: 60 },
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    getRowId: (row) => String(row.id),
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange: setRowSelection,
    getColumnCanGlobalFilter: (column) => column.id === "term",
    globalFilterFn: (row, _columnId, filter: string) => {
      const q = filter.toLowerCase();
      return row.original.term.includes(q) || (row.original.notes ?? "").toLowerCase().includes(q);
    },
    meta: { actions },
  });

  const selected = table.getSelectedRowModel().rows.map((r) => r.original);
  const rows = table.getRowModel().rows;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* One scroll container for both axes, so the horizontal scrollbar sits at the bottom of the view however few rows there are. */}
      {/* `relative` so absolutely positioned bits inside cells (e.g. Radix's hidden checkbox inputs) are clipped here instead of widening the page. */}
      <div className={cn("relative min-h-0 flex-1 overflow-auto", selected.length > 0 && "pb-16")}>
        {/* Plain <table>: the ui Table wraps itself in its own overflow container, which would break the sticky header. */}
        <table
          data-slot="table"
          className="w-full table-fixed caption-bottom text-sm"
          style={{ minWidth: table.getTotalSize() }}
        >
          {/* Borders don't stick with border-collapse, so the header's bottom edge is an inset shadow. */}
          <TableHeader className="bg-background sticky top-0 z-10 [&_tr]:border-b-0">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="bg-muted/40 hover:bg-muted/40">
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{
                      width: header.column.id === FILL_COLUMN ? undefined : header.getSize(),
                    }}
                    className="text-muted-foreground relative h-10 text-xs font-medium shadow-[inset_0_-1px_0_var(--color-border)] first:pl-4 last:pr-4"
                  >
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                    {header.column.getCanResize() && (
                      <div
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Resize ${header.column.columnDef.meta?.label ?? header.column.id} column`}
                        className={cn(
                          "after:bg-border hover:after:bg-primary absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none select-none after:absolute after:inset-y-2 after:left-1/2 after:w-px",
                          header.column.getIsResizing() && "after:bg-primary",
                        )}
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onDoubleClick={() => header.column.resetSize()}
                      />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {table.getVisibleLeafColumns().map((c) => (
                    <TableCell key={c.id} className="h-12 first:pl-4 last:pr-4">
                      <Skeleton className="h-4 w-full max-w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!isLoading &&
              rows.map((row) => (
                <ContextMenu key={row.id}>
                  <ContextMenuTrigger asChild>
                    <TableRow
                      data-state={row.getIsSelected() ? "selected" : undefined}
                      className={cn(
                        "group/row select-auto",
                        actions.refreshingIds.has(row.original.id) && "animate-pulse",
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="h-12 overflow-hidden first:pl-4 last:pr-4">
                          <table.FlexRender cell={cell} />
                        </TableCell>
                      ))}
                    </TableRow>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="min-w-48">
                    <KeywordActionsMenuItems keyword={row.original} actions={actions} />
                  </ContextMenuContent>
                </ContextMenu>
              ))}
          </TableBody>
        </table>

        {/* Outside the table and pinned left so it centers in the visible width, not the full scroll width. */}
        {!isLoading && rows.length === 0 && (
          <div className="sticky left-0">
            {globalFilter ? (
              <p className="text-muted-foreground py-16 text-center text-sm">No keywords match “{globalFilter}”.</p>
            ) : (
              emptyState
            )}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center">
          <div className="bg-popover pointer-events-auto flex items-center gap-1 rounded-lg border px-2 py-1 text-sm shadow-lg">
            <span className="px-1 font-medium tabular-nums">{selected.length} selected</span>
            <Button size="sm" variant="ghost" onClick={() => actions.onRefresh(selected.map((k) => k.id))}>
              <RefreshCwIcon /> Refresh
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void navigator.clipboard.writeText(selected.map((k) => k.term).join(", "));
                toast.success(`Copied ${selected.length} keywords`);
              }}
            >
              <CopyIcon /> Copy
            </Button>
            {actions.editable && selected.some((k) => k.tracked) && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  actions.onRemove(selected.filter((k) => k.tracked));
                  setRowSelection({});
                }}
              >
                <Trash2Icon /> Remove
              </Button>
            )}
            <Button size="icon-sm" variant="ghost" onClick={() => setRowSelection({})}>
              <XIcon />
              <span className="sr-only">Clear selection</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
