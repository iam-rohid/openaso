"use client";

import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TRPCReactProvider } from "@/trpc/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <NuqsAdapter>
        <TRPCReactProvider>
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster richColors position="bottom-right" />
          </TooltipProvider>
        </TRPCReactProvider>
      </NuqsAdapter>
    </ThemeProvider>
  );
}
