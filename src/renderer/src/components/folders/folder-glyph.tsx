import { FolderIcon } from "lucide-react";
import { DEFAULT_FOLDER_COLOR, type FolderColor, folderColorClasses } from "@shared/folders";
import { cn } from "@/lib/utils";

/** Solid folder icon tinted with the folder's color. */
export function FolderGlyph({ color, className }: { color: FolderColor; className?: string }) {
  const classes = folderColorClasses[color] ?? folderColorClasses[DEFAULT_FOLDER_COLOR];
  return <FolderIcon className={cn("fill-current", classes.text, className)} />;
}
