import { useState } from "react";
import { DownloadIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";
import type { UpdateStatus } from "@shared/ipc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUpdate } from "@/hooks/use-update";

/** Restarts into a downloaded update, or (.deb) opens the release page to download it. */
function applyUpdate(update: UpdateStatus) {
  if (update.kind === "ready") window.openaso.installUpdate();
  else window.open(update.url);
}

/** Sidebar footer row that only appears once a newer version is ready (or, for the .deb, available). */
export function UpdateItem() {
  const update = useUpdate();
  const [notesOpen, setNotesOpen] = useState(false);
  if (!update) return null;

  const ready = update.kind === "ready";
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        size="lg"
        onClick={() => applyUpdate(update)}
        className="bg-indigo-600 text-white hover:bg-indigo-500 hover:text-white active:bg-indigo-500 active:text-white"
      >
        {ready ? <RefreshCwIcon /> : <DownloadIcon />}
        <div className="grid flex-1 text-left leading-tight">
          <span className="truncate font-medium">{ready ? "Restart to update" : "Update available"}</span>
          <span className="truncate text-xs opacity-80">
            {ready ? `v${update.version} is ready` : `Download v${update.version}`}
          </span>
        </div>
      </SidebarMenuButton>
      {update.notes && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarMenuAction
                onClick={() => setNotesOpen(true)}
                className="text-white peer-hover/menu-button:text-white hover:bg-white/15 hover:text-white"
              >
                <SparklesIcon />
                <span className="sr-only">What's new</span>
              </SidebarMenuAction>
            </TooltipTrigger>
            <TooltipContent side="right">What's new</TooltipContent>
          </Tooltip>
          <ReleaseNotesDialog update={update} notes={update.notes} open={notesOpen} onOpenChange={setNotesOpen} />
        </>
      )}
    </SidebarMenuItem>
  );
}

function ReleaseNotesDialog({
  update,
  notes,
  open,
  onOpenChange,
}: {
  update: UpdateStatus;
  notes: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>What's new in OpenASO {update.version}</DialogTitle>
          <DialogDescription className="sr-only">Release notes for the update.</DialogDescription>
        </DialogHeader>
        {/* GitHub's rendering of our own release body. The page's CSP blocks inline scripts and
            handlers, and links open in the browser (see the main process's navigation handlers). */}
        <div
          className="max-h-[60vh] overflow-y-auto text-sm [&_a]:underline [&_a]:underline-offset-2 [&_h1,&_h2,&_h3]:mt-4 [&_h1,&_h2,&_h3]:mb-1.5 [&_h1,&_h2,&_h3]:font-medium [&_h1,&_h2,&_h3]:first:mt-0 [&_li]:my-0.5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_code]:font-mono [&_code]:text-xs"
          dangerouslySetInnerHTML={{ __html: notes }}
        />
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Later
          </Button>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => applyUpdate(update)}>
            {update.kind === "ready" ? "Restart to Update" : "Download"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
