import { Separator } from "@/components/ui/separator";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { useUpdate } from "@/hooks/use-update";
import { cn } from "@/lib/utils";

/** Sticky toolbar at the top of every page (sidebar toggle + page controls). */
export function PageHeader({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "bg-background/80 sticky top-0 z-20 flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 backdrop-blur",
        className,
      )}
    >
      <SidebarToggle />
      {/* The base separator stretches to the row; pin it to a short, centered line. */}
      <Separator orientation="vertical" className="mr-1 h-5! self-center!" />
      {children}
    </header>
  );
}

/** The sidebar toggle, with a dot while an update waits in the hidden sidebar's footer. */
function SidebarToggle() {
  const update = useUpdate();
  const { state, isMobile, openMobile } = useSidebar();
  const hidden = isMobile ? !openMobile : state === "collapsed";
  if (!update || !hidden) return <SidebarTrigger />;
  return (
    <div className="relative">
      <SidebarTrigger />
      <span className="ring-background bg-indigo-500 pointer-events-none absolute top-1 right-1 size-2 rounded-full ring-2" />
      <span className="sr-only">An update is available</span>
    </div>
  );
}
