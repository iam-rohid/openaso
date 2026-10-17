import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useTRPC } from "@/trpc/react";
import type { CountryCode } from "@shared/countries";
import type { TrendWindow } from "@shared/trends";

const plural = (n: number) => `${n} keyword${n === 1 ? "" : "s"}`;

/** Import result toast, e.g. "Imported 42 keywords (US 30, GB 12)". */
function importSummary(added: Partial<Record<string, number>>, alreadyTracked: number, skipped: number) {
  const counts = Object.entries(added) as [string, number][];
  const total = counts.reduce((sum, [, n]) => sum + n, 0);
  const parts = [
    `Imported ${plural(total)}${counts.length > 1 ? ` (${counts.map(([c, n]) => `${c} ${n}`).join(", ")})` : ""}`,
  ];
  if (alreadyTracked) parts.push(`${alreadyTracked} already tracked`);
  if (skipped) parts.push(`${skipped} skipped`);
  return parts.join(", ");
}

/**
 * Header menu items that export an app's keywords in one storefront to an Astro-compatible CSV,
 * or import them from one. Newly cached keywords are handed to `onImported` to refresh.
 */
export function KeywordTransferItems({
  appId,
  country,
  window,
  canExport,
  onImported,
}: {
  appId: string;
  country: CountryCode;
  window: TrendWindow;
  canExport: boolean;
  onImported: (refreshIds: number[]) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const exportCsv = useMutation(
    trpc.keywords.exportCsv.mutationOptions({
      onSuccess: (result) => {
        if (!result.canceled) toast.success(`Exported ${plural(result.count)}`);
      },
      onError: (err) => toast.error(err.message),
    }),
  );
  const importCsv = useMutation(
    trpc.keywords.importCsv.mutationOptions({
      onSuccess: async (result) => {
        if (result.canceled) return;
        await Promise.all([
          queryClient.invalidateQueries(trpc.keywords.pathFilter()),
          queryClient.invalidateQueries(trpc.apps.tracked.pathFilter()),
        ]);
        toast.success(importSummary(result.added, result.alreadyTracked, result.skipped));
        if (result.refreshIds.length > 0) onImported(result.refreshIds);
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <>
      <DropdownMenuItem
        disabled={!canExport || exportCsv.isPending}
        onSelect={() => exportCsv.mutate({ appId, country, window })}
      >
        <DownloadIcon /> Export Keywords…
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={importCsv.isPending}
        onSelect={() => importCsv.mutate({ appId, fallbackCountry: country })}
      >
        <UploadIcon /> Import Keywords…
      </DropdownMenuItem>
      <DropdownMenuSeparator />
    </>
  );
}
