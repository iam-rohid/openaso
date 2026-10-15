import { notFound } from "next/navigation";
import { AppKeywordsView } from "@/components/apps/app-keywords-view";

export default async function AppPage({ params }: PageProps<"/apps/[appId]">) {
  const { appId } = await params;
  if (!/^\d+$/.test(appId)) notFound();
  return <AppKeywordsView appId={appId} />;
}
