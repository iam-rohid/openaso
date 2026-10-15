import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/** Sticky toolbar at the top of every page (sidebar toggle + page controls). */
export function PageHeader({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        "bg-background/80 sticky top-0 z-20 flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 backdrop-blur",
        className,
      )}
    >
      <SidebarTrigger />
      {/* The base separator stretches to the row; pin it to a short, centered line. */}
      <Separator orientation="vertical" className="mr-1 h-5! self-center!" />
      {children}
    </header>
  );
}
