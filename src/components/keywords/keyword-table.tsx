"use client";

import {
  useTable,
  type ColumnVisibilityState,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { Columns3Icon, CopyIcon, RefreshCwIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { cn } from "@/lib/utils";
import { keywordColumns } from "./keyword-columns";
import {
  keywordTableFeatures,
  type KeywordRow,
  type KeywordTableActions,
} from "./keyword-table-features";

const EMPTY: KeywordRow[] = [];

const DEFAULT_SORT: SortingState = [{ id: "popularity", desc: true }];
const DEFAULT_VISIBILITY: ColumnVisibilityState = { results: false };

export function KeywordTable({
  data,
  isLoading,
  actions,
  emptyState,
  toolbar,
}: {
  data: KeywordRow[] | undefined;
  isLoading: boolean;
  actions: KeywordTableActions;
  emptyState: React.ReactNode;
  /** Extra controls rendered on the right of the table toolbar. */
  toolbar?: React.ReactNode;
}) {
  const [sorting, setSorting] = useLocalStorageState<SortingState>("openaso:kw-sort", DEFAULT_SORT);
  const [columnVisibility, setColumnVisibility] = useLocalStorageState<ColumnVisibilityState>(
    "openaso:kw-columns",
    DEFAULT_VISIBILITY,
  );
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useTable({
    features: keywordTableFeatures,
    data: data ?? EMPTY,
    columns: keywordColumns,
    state: { sorting, columnVisibility, globalFilter, rowSelection },
    getRowId: (row) => String(row.id),
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
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
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <InputGroup className="w-full max-w-64">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Filter keywords…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
        </InputGroup>

        {selected.length > 0 ? (
          <div className="bg-muted/60 flex items-center gap-1 rounded-lg border px-2 py-1 text-sm">
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
        ) : (
          <span className="text-muted-foreground text-sm tabular-nums">
            {data ? `${rows.length} keyword${rows.length === 1 ? "" : "s"}` : ""}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {toolbar}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3Icon /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((c) => c.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(v) => column.toggleVisibility(!!v)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {column.columnDef.meta?.label ?? column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-4 pb-4">
        <div className="overflow-hidden rounded-xl border">
          <Table className="table-fixed">
            <TableHeader className="bg-muted/40">
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id} className="hover:bg-transparent">
                  {group.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="text-muted-foreground h-10 text-xs font-medium"
                    >
                      {header.isPlaceholder ? null : <table.FlexRender header={header} />}
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
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={cn(
                      "group/row",
                      actions.refreshingIds.has(row.original.id) && "animate-pulse",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="h-12 overflow-hidden">
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
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
      </div>
    </div>
  );
}
