import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TRPCReactProvider } from "@/trpc/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TRPCReactProvider>
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster richColors position="bottom-right" />
        </TooltipProvider>
      </TRPCReactProvider>
    </ThemeProvider>
  );
}
