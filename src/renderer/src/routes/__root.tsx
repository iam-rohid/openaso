import { createRootRoute, HeadContent, Link, Outlet, useParams } from "@tanstack/react-router";
import { CompassIcon } from "lucide-react";
import { useEffect } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Providers } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { SIDEBAR_STORAGE_KEY, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { rememberLastApp, restoreLastApp } from "@/lib/last-app";

export const Route = createRootRoute({
  head: () => ({ meta: [{ title: "OpenASO" }] }),
  beforeLoad: ({ location }) => restoreLastApp(location.pathname),
  component: RootLayout,
  notFoundComponent: NotFound,
});

function sidebarDefaultOpen() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function RootLayout() {
  const { appId } = useParams({ strict: false });
  useEffect(() => rememberLastApp(appId), [appId]);

  return (
    <Providers>
      <HeadContent />
      <SidebarProvider defaultOpen={sidebarDefaultOpen()}>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </Providers>
  );
}

function NotFound() {
  return (
    <Empty className="m-auto">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CompassIcon />
        </EmptyMedia>
        <EmptyTitle>Page not found</EmptyTitle>
        <EmptyDescription>This page doesn&apos;t exist.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link to="/">Back to My Apps</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
