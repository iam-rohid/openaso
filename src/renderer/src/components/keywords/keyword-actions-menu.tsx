import { CopyIcon, ListOrderedIcon, RefreshCwIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import type { KeywordRow, KeywordTableActions } from "./keyword-table-features";

export function copyKeyword(term: string) {
  void navigator.clipboard.writeText(term);
  toast.success(`Copied “${term}”`);
}

const menus = {
  dropdown: { Item: DropdownMenuItem, Separator: DropdownMenuSeparator },
  context: { Item: ContextMenuItem, Separator: ContextMenuSeparator },
};

/** Row actions shared by the "more" dropdown and the right-click context menu. */
export function KeywordActionsMenuItems({
  keyword: k,
  actions,
  menu,
}: {
  keyword: KeywordRow;
  actions: KeywordTableActions;
  menu: keyof typeof menus;
}) {
  const { Item, Separator } = menus[menu];
  return (
    <>
      <Item onClick={() => actions.onOpenRanking(k)}>
        <ListOrderedIcon /> View ranking
      </Item>
      <Item onClick={() => actions.onRefresh([k.id])}>
        <RefreshCwIcon /> Refresh data
      </Item>
      {actions.editable && (
        <Item onClick={() => actions.onSuggest(k.term)}>
          <SparklesIcon /> Similar keywords
        </Item>
      )}
      <Item onClick={() => copyKeyword(k.term)}>
        <CopyIcon /> Copy keyword
      </Item>
      {actions.editable && k.tracked && (
        <>
          <Separator />
          <Item variant="destructive" onClick={() => actions.onRemove([k])}>
            <Trash2Icon /> Remove
          </Item>
        </>
      )}
    </>
  );
}
