import { useTable, type RowSelectionState } from "@tanstack/react-table";
import { CopyIcon, RefreshCwIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { KeywordActionsMenuItems } from "./keyword-actions-menu";
import { keywordColumns } from "./keyword-columns";
import { useKeywordColumnSizing, useKeywordColumnVisibility, useKeywordSorting } from "./keyword-table-prefs";
import {
  keywordTableFeatures,
  type KeywordRow,
  type KeywordTableActions,
} from "./keyword-table-features";

const EMPTY: KeywordRow[] = [];

/** The actions column has no fixed width so it absorbs leftover space and the other columns keep their sizes. */
const FILL_COLUMN = "actions";

export function KeywordTable({
  data,
  isLoading,
  actions,
  emptyState,
  globalFilter,
}: {
  data: KeywordRow[] | undefined;
  isLoading: boolean;
  actions: KeywordTableActions;
  emptyState: React.ReactNode;
  /** Text filter over keyword terms and notes, controlled by the page. */
  globalFilter: string;
}) {
  const [sorting, setSorting] = useKeywordSorting();
  const [columnVisibility, setColumnVisibility] = useKeywordColumnVisibility();
  const [columnSizing, setColumnSizing] = useKeywordColumnSizing();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useTable({
    features: keywordTableFeatures,
    data: data ?? EMPTY,
    columns: keywordColumns,
    state: { sorting, columnVisibility, columnSizing, globalFilter, rowSelection },
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 px-4 py-3">
        <div className="overflow-hidden rounded-xl border">
          <Table className="table-fixed" style={{ minWidth: table.getTotalSize() }}>
            <TableHeader className="bg-muted/40">
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id} className="hover:bg-transparent">
                  {group.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.column.id === FILL_COLUMN ? undefined : header.getSize() }}
                      className="text-muted-foreground relative h-10 text-xs font-medium"
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
                      <TableCell key={c.id} className="h-12">
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
                          <TableCell
                            key={cell.id}
                            className={cn("h-12 overflow-hidden", cell.column.id === FILL_COLUMN && "text-right")}
                          >
                            <table.FlexRender cell={cell} />
                          </TableCell>
                        ))}
                      </TableRow>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="min-w-48">
                      <KeywordActionsMenuItems keyword={row.original} actions={actions} menu="context" />
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              {!isLoading && rows.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={table.getVisibleLeafColumns().length} className="p-0">
                    {globalFilter ? (
                      <p className="text-muted-foreground py-16 text-center text-sm">
                        No keywords match “{globalFilter}”.
                      </p>
                    ) : (
                      emptyState
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {selected.length > 0 && (
          <div className="pointer-events-none sticky bottom-4 z-10 mt-3 flex justify-center">
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
    </div>
  );
}
