import type { ColumnSizingState, ColumnVisibilityState, SortingState } from "@tanstack/react-table";
import { DEFAULT_TREND_WINDOW, type TrendWindow } from "@shared/trends";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";

const DEFAULT_SORT: SortingState = [{ id: "popularity", desc: true }];
const DEFAULT_VISIBILITY: ColumnVisibilityState = { results: false };
const DEFAULT_SIZING: ColumnSizingState = {};

// Shared by every app's keyword table (and the header's columns menu), so the layout stays
// consistent across apps and restarts.
export const useKeywordSorting = () => useLocalStorageState<SortingState>("openaso:kw-sort", DEFAULT_SORT);
export const useKeywordColumnVisibility = () =>
  useLocalStorageState<ColumnVisibilityState>("openaso:kw-columns", DEFAULT_VISIBILITY);
export const useKeywordColumnSizing = () =>
  useLocalStorageState<ColumnSizingState>("openaso:kw-sizes", DEFAULT_SIZING);
/** The window every trend delta on the app page compares over. */
export const useTrendWindow = () => useLocalStorageState<TrendWindow>("openaso:trend-window", DEFAULT_TREND_WINDOW);
