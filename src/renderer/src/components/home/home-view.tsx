import { useQuery } from "@tanstack/react-query";
import { CompassIcon, KeyRoundIcon, PlusIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { AddAppDialog } from "@/components/apps/add-app-dialog";
import { AppCard } from "@/components/apps/app-card";
import { FolderCard } from "@/components/folders/folder-card";
import { PageHeader } from "@/components/layout/page-header";
import { CountrySelect } from "@/components/shared/country-select";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useCountry } from "@/hooks/use-country";
import { useTRPC } from "@/trpc/react";

export function HomeView() {
  const trpc = useTRPC();
  const [country] = useCountry();
  const [addOpen, setAddOpen] = useState(false);
  const tracked = useQuery(trpc.apps.tracked.queryOptions({ country }));
  const folders = useQuery(trpc.folders.list.queryOptions({ country }));
  const looseApps = tracked.data?.filter((app) => app.folderId == null) ?? [];
  const isEmpty = tracked.data?.length === 0 && folders.data?.length === 0;

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader>
        <h1 className="text-sm font-semibold">Home</h1>
        <div className="ml-auto flex items-center gap-2">
          <CountrySelect />
          <Button asChild variant="outline">
            <Link to="/explore">
              <CompassIcon /> Explore keywords
            </Link>
          </Button>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => setAddOpen(true)}>
            Add App <PlusIcon />
          </Button>
        </div>
      </PageHeader>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">My Apps</h2>
          <p className="text-muted-foreground text-sm">
            Track keyword rankings, popularity and difficulty across App Store storefronts. Everything is stored on
            this computer.
          </p>
        </div>

        {(tracked.isLoading || folders.isLoading) && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        )}

        {isEmpty && (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <KeyRoundIcon />
              </EmptyMedia>
              <EmptyTitle>Add your first app</EmptyTitle>
              <EmptyDescription>
                Search the App Store for your app (or a competitor), then add keywords or let OpenASO suggest
                some.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => setAddOpen(true)}>
                Add App <PlusIcon />
              </Button>
            </EmptyContent>
          </Empty>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {folders.data?.map((folder) => (
            <FolderCard key={folder.id} folder={folder} />
          ))}
          {looseApps.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      </main>
      <AddAppDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
