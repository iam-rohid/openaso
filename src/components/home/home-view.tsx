"use client";

import { useQuery } from "@tanstack/react-query";
import { CompassIcon, KeyRoundIcon, PlusIcon, StarIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AddAppDialog } from "@/components/apps/add-app-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { AppIcon } from "@/components/shared/app-icon";
import { CountrySelect } from "@/components/shared/country-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useCountry, withCountry } from "@/hooks/use-country";
import { compactNumber } from "@/lib/format";
import { useTRPC } from "@/trpc/react";

export function HomeView() {
  const trpc = useTRPC();
  const [country] = useCountry();
  const [addOpen, setAddOpen] = useState(false);
  const tracked = useQuery(trpc.apps.tracked.queryOptions({ country }));

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader>
        <h1 className="text-sm font-semibold">Home</h1>
        <div className="ml-auto flex items-center gap-2">
          <CountrySelect />
          <Button asChild variant="outline">
            <Link href={withCountry("/explore", country)}>
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
            Track keyword rankings, popularity and difficulty across App Store storefronts. Everything is cached in
            your local Postgres.
          </p>
        </div>

        {tracked.isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        )}

        {tracked.data?.length === 0 && (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <KeyRoundIcon />
              </EmptyMedia>
              <EmptyTitle>Add your first app</EmptyTitle>
              <EmptyDescription>
                Search the App Store for your app (or a competitor), then add keywords or let Free Astro suggest
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
          {tracked.data?.map((app) => (
            <Link key={app.id} href={withCountry(`/apps/${app.id}`, country)}>
              <Card className="hover:border-primary/40 hover:bg-muted/30 h-full transition-colors">
                <CardContent className="flex items-center gap-4">
                  <AppIcon src={app.iconUrl} name={app.name} size={56} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-semibold">{app.name}</p>
                    <p className="text-muted-foreground truncate text-xs">{app.developer}</p>
                    <div className="text-muted-foreground flex items-center gap-3 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <KeyRoundIcon className="size-3" /> {app.keywordCount} keywords
                      </span>
                      {app.rating != null && (
                        <span className="inline-flex items-center gap-1">
                          <StarIcon className="size-3 fill-current" /> {app.rating.toFixed(1)} (
                          {compactNumber(app.ratingCount)})
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
      <AddAppDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
