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
import type { RouterOutputs } from "@/trpc/react";

export type KeywordRow = RouterOutputs["keywords"]["list"][number];

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
