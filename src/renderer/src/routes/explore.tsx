import { createFileRoute } from "@tanstack/react-router";
import { KeywordExplorer } from "@/components/explore/keyword-explorer";

export const Route = createFileRoute("/explore")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" && search.q ? search.q : undefined,
  }),
  head: () => ({ meta: [{ title: "Keyword Explorer · OpenASO" }] }),
  component: KeywordExplorer,
});
