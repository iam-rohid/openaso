import { createFileRoute, notFound } from "@tanstack/react-router";
import { AppKeywordsView } from "@/components/apps/app-keywords-view";

export const Route = createFileRoute("/apps/$appId")({
  validateSearch: (search: Record<string, unknown>): { view?: "ranked" } => ({
    view: search.view === "ranked" ? "ranked" : undefined,
  }),
  beforeLoad: ({ params }) => {
    if (!/^\d+$/.test(params.appId)) throw notFound();
  },
  component: AppPage,
});

function AppPage() {
  const { appId } = Route.useParams();
  return <AppKeywordsView key={appId} appId={appId} />;
}
