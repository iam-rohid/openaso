import { createFileRoute, notFound } from "@tanstack/react-router";
import { FolderView } from "@/components/folders/folder-view";

export const Route = createFileRoute("/folders/$folderId")({
  beforeLoad: ({ params }) => {
    if (!/^[1-9]\d{0,9}$/.test(params.folderId)) throw notFound();
  },
  component: FolderPage,
});

function FolderPage() {
  const { folderId } = Route.useParams();
  return <FolderView key={folderId} folderId={Number(folderId)} />;
}
