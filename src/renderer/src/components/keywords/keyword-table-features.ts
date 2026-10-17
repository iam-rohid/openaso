import {
  columnFilteringFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  metaHelper,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";
import type { DailyPosition, Trend } from "@shared/trends";
import type { RouterOutputs } from "@/trpc/react";

export type KeywordListRow = RouterOutputs["keywords"]["list"][number];
/**
 * A list row with its trend for the page's chosen window picked out, so the Trend column
 * can sort by it, and the tail of its history that the column's sparkline covers.
 */
export type KeywordRow = KeywordListRow & { trend: Trend; sparkline: DailyPosition[] };

export type KeywordTableActions = {
  appId: string;
  /** Tracked apps can edit notes / remove keywords. */
  editable: boolean;
  refreshingIds: Set<number>;
  onOpenRanking: (row: KeywordRow) => void;
  onRefresh: (ids: number[]) => void;
  onRemove: (rows: KeywordRow[]) => void;
  onSuggest: (term: string) => void;
};

/** TanStack Table v9 registers only the features a table actually uses. */
export const keywordTableFeatures = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  columnSizingFeature,
  columnResizingFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns: { text: sortFn_text, basic: sortFn_basic },
  tableMeta: metaHelper<{ actions: KeywordTableActions }>(),
  columnMeta: metaHelper<{ label?: string }>(),
});

export type KeywordTableFeatures = typeof keywordTableFeatures;
