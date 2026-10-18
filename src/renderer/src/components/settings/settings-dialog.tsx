import { CableIcon, SettingsIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { GeneralSettings } from "./general-settings";
import { McpSettings } from "./mcp-settings";

export const SETTINGS_PAGES = [
  { id: "general", label: "General", icon: SettingsIcon, content: GeneralSettings },
  { id: "mcp", label: "MCP Server", icon: CableIcon, content: McpSettings },
] as const;
export type SettingsPage = (typeof SETTINGS_PAGES)[number]["id"];

/** App settings, one page at a time, picked from the dialog's own sidebar. */
export function SettingsDialog({
  page,
  onPageChange,
}: {
  /** The open page, or null when the dialog is closed. */
  page: SettingsPage | null;
  onPageChange: (page: SettingsPage | null) => void;
}) {
  const current = SETTINGS_PAGES.find((p) => p.id === page) ?? SETTINGS_PAGES[0];
  const Content = current.content;

  return (
    <Dialog open={page != null} onOpenChange={(open) => !open && onPageChange(null)}>
      <DialogContent
        className="flex h-[min(640px,calc(100vh-4rem))] gap-0 overflow-hidden p-0 sm:max-w-4xl"
        // Focusing the first page button would show its focus ring on every page.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">OpenASO settings</DialogDescription>
        <nav className="flex w-52 shrink-0 flex-col gap-0.5 border-r bg-sidebar p-2 pt-4">
          <div className="px-2 pb-2 text-xs font-medium text-muted-foreground">Settings</div>
          {SETTINGS_PAGES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              data-active={id === current.id}
              onClick={() => onPageChange(id)}
              className={cn(
                "flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm text-sidebar-foreground outline-none",
                "hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring",
                "data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium",
                "[&_svg]:size-4 [&_svg]:shrink-0",
              )}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 overflow-y-auto bg-background px-8 pt-6 pb-8">
          <Content />
        </div>
      </DialogContent>
    </Dialog>
  );
}
