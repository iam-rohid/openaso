import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TRPCReactProvider } from "@/trpc/react";
import { UpdateNotifier } from "./update-notifier";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TRPCReactProvider>
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster richColors position="bottom-right" />
          <UpdateNotifier />
        </TooltipProvider>
      </TRPCReactProvider>
    </ThemeProvider>
  );
}
