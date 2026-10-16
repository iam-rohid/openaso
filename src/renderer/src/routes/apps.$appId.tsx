import { createFileRoute, notFound } from "@tanstack/react-router";
import { AppKeywordsView } from "@/components/apps/app-keywords-view";
import { APP_ID_PATTERN } from "@shared/apps";

export const Route = createFileRoute("/apps/$appId")({
  beforeLoad: ({ params }) => {
    if (!APP_ID_PATTERN.test(params.appId)) throw notFound();
  },
  component: AppPage,
});

function AppPage() {
  const { appId } = Route.useParams();
  return <AppKeywordsView key={appId} appId={appId} />;
}
