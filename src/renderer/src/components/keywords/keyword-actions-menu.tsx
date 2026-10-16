import { CopyIcon, ListOrderedIcon, RefreshCwIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import type { KeywordRow, KeywordTableActions } from "./keyword-table-features";

export function copyKeyword(term: string) {
  void navigator.clipboard.writeText(term);
  toast.success(`Copied “${term}”`);
}

/** Row actions for the right-click context menu. */
export function KeywordActionsMenuItems({
  keyword: k,
  actions,
}: {
  keyword: KeywordRow;
  actions: KeywordTableActions;
}) {
  return (
    <>
      <ContextMenuItem onClick={() => actions.onOpenRanking(k)}>
        <ListOrderedIcon /> View ranking
      </ContextMenuItem>
      <ContextMenuItem onClick={() => actions.onRefresh([k.id])}>
        <RefreshCwIcon /> Refresh data
      </ContextMenuItem>
      {actions.editable && (
        <ContextMenuItem onClick={() => actions.onSuggest(k.term)}>
          <SparklesIcon /> Similar keywords
        </ContextMenuItem>
      )}
      <ContextMenuItem onClick={() => copyKeyword(k.term)}>
        <CopyIcon /> Copy keyword
      </ContextMenuItem>
      {actions.editable && k.tracked && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onClick={() => actions.onRemove([k])}>
            <Trash2Icon /> Remove
          </ContextMenuItem>
        </>
      )}
    </>
  );
}
