import { Link } from "@tanstack/react-router";
import { AppIcon } from "@/components/shared/app-icon";
import { Card, CardContent } from "@/components/ui/card";
import type { FolderColor } from "@shared/folders";
import { FolderGlyph } from "./folder-glyph";

/** Grid card for a folder: colored icon, counts, and a peek at the first few apps inside. */
export function FolderCard({
  folder,
}: {
  folder: {
    id: number;
    name: string;
    color: FolderColor;
    appCount: number;
    keywordCount: number;
    previewIcons: (string | null)[];
  };
}) {
  return (
    <Link to="/folders/$folderId" params={{ folderId: String(folder.id) }}>
      <Card className="hover:border-primary/40 hover:bg-muted/30 h-full transition-colors">
        <CardContent className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center">
            <FolderGlyph color={folder.color} className="size-12" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate font-semibold">{folder.name}</p>
            <p className="text-muted-foreground truncate text-xs">
              {folder.appCount} app{folder.appCount === 1 ? "" : "s"} · {folder.keywordCount} keywords
            </p>
            {folder.previewIcons.length > 0 && (
              <div className="flex items-center gap-1">
                {folder.previewIcons.map((src, i) => (
                  <AppIcon key={i} src={src} name={folder.name} size={18} />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
