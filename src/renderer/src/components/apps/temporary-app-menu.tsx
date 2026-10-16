import { EllipsisIcon, LinkIcon, PencilIcon } from "lucide-react";
import { useState } from "react";
import { AddAppDialog } from "@/components/apps/add-app-dialog";
import { RenameTemporaryAppDialog } from "@/components/apps/temporary-app-form";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAfterMenuClose } from "@/hooks/use-after-menu-close";

/** Header menu for a temporary app, standing in for the App Store links real apps get. */
export function TemporaryAppMenu({ app }: { app: { id: string; name: string } }) {
  const menu = useAfterMenuClose();
  const [renameOpen, setRenameOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <EllipsisIcon />
            <span className="sr-only">App actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48" onCloseAutoFocus={menu.onCloseAutoFocus}>
          <DropdownMenuItem onSelect={() => menu.defer(() => setRenameOpen(true))}>
            <PencilIcon /> Rename…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => menu.defer(() => setLinkOpen(true))}>
            <LinkIcon /> Link to App Store app…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameTemporaryAppDialog app={app} open={renameOpen} onOpenChange={setRenameOpen} />
      <AddAppDialog open={linkOpen} onOpenChange={setLinkOpen} linkFrom={app} />
    </>
  );
}
