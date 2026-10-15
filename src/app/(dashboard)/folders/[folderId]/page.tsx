import { notFound } from "next/navigation";
import { FolderView } from "@/components/folders/folder-view";

export default async function FolderPage({ params }: PageProps<"/folders/[folderId]">) {
  const { folderId } = await params;
  if (!/^[1-9]\d{0,9}$/.test(folderId)) notFound();
  return <FolderView folderId={Number(folderId)} />;
}
