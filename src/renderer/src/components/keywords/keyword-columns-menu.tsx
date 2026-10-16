import { Columns3Icon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { keywordColumns, RANK_COLUMN_IDS } from "./keyword-columns";
import { useKeywordColumnSizing, useKeywordColumnVisibility } from "./keyword-table-prefs";

const hideableColumns = keywordColumns
  .filter((c) => c.enableHiding !== false)
  .map((c) => ({
    id: (c.id ?? ("accessorKey" in c ? String(c.accessorKey) : "")) as string,
    label: c.meta?.label,
  }));

/** Toggles keyword table columns; shares persisted state with every keyword table. */
export function KeywordColumnsMenu({ hideRankColumns = false }: { hideRankColumns?: boolean }) {
  const [visibility, setVisibility] = useKeywordColumnVisibility();
  const [sizing, setSizing] = useKeywordColumnSizing();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Columns3Icon />
          <span className="sr-only">Columns</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hideableColumns
          .filter((column) => !hideRankColumns || !RANK_COLUMN_IDS.includes(column.id))
          .map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={visibility[column.id] !== false}
              onCheckedChange={(v) => setVisibility((prev) => ({ ...prev, [column.id]: !!v }))}
              onSelect={(e) => e.preventDefault()}
            >
              {column.label ?? column.id}
            </DropdownMenuCheckboxItem>
          ))}
        {Object.keys(sizing).length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSizing({})}>
              <RotateCcwIcon /> Reset column widths
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
