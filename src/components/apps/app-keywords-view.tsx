"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDownIcon,
  ExternalLinkIcon,
  EyeIcon,
  LightbulbIcon,
  PlusIcon,
  RefreshCwIcon,
  StarIcon,
} from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AddKeywordsDialog } from "@/components/keywords/add-keywords-dialog";
import { KeywordTable } from "@/components/keywords/keyword-table";
import type { KeywordRow, KeywordTableActions } from "@/components/keywords/keyword-table-features";
import { RankingSheet, type RankingTarget } from "@/components/keywords/ranking-sheet";
import { SuggestionsDialog } from "@/components/keywords/suggestions-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { AppIcon } from "@/components/shared/app-icon";
import { CountrySelect } from "@/components/shared/country-select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCountry } from "@/hooks/use-country";
import { compactNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/react";

const scopeParser = parseAsStringLiteral(["tracked", "ranked"] as const).withDefault("tracked");

export function AppKeywordsView({ appId }: { appId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [country] = useCountry();
  const [scopeParam, setScope] = useQueryState("view", scopeParser);

  const [addOpen, setAddOpen] = useState(false);
  const [suggest, setSuggest] = useState<{ open: boolean; seed?: string }>({ open: false });
  const [ranking, setRanking] = useState<RankingTarget | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<KeywordRow[] | null>(null);
  const [refreshingIds, setRefreshingIds] = useState<Set<number>>(new Set());

  const app = useQuery(trpc.apps.get.queryOptions({ id: appId, country }));
  const isTracked = app.data?.isTracked ?? false;
  // Untracked apps (competitors) only have the "ranked" view.
  const scope = app.data && !isTracked ? "ranked" : scopeParam;

  const keywords = useQuery({
    ...trpc.keywords.list.queryOptions({ appId, country, scope }),
    enabled: !!app.data,
  });

  const invalidateKeywords = () => queryClient.invalidateQueries(trpc.keywords.pathFilter());

  const refresh = useMutation(
    trpc.keywords.refresh.mutationOptions({
      onMutate: ({ keywordIds }) => setRefreshingIds(new Set(keywordIds)),
      onSuccess: async ({ refreshed, failed }) => {
        await invalidateKeywords();
        if (failed) toast.warning(`Refreshed ${refreshed}, ${failed} failed (Apple may be rate limiting)`);
        else toast.success(`Refreshed ${refreshed} keyword${refreshed === 1 ? "" : "s"}`);
      },
      onError: (err) => toast.error(err.message),
      onSettled: () => setRefreshingIds(new Set()),
    }),
  );
  const refreshApp = useMutation(
    trpc.keywords.refreshApp.mutationOptions({
      onMutate: ({ all }) => {
        const rows = keywords.data ?? [];
        setRefreshingIds(new Set(rows.filter((k) => all || k.stale).map((k) => k.id)));
      },
      onSuccess: async ({ refreshed, failed }) => {
        await invalidateKeywords();
        if (refreshed === 0 && failed === 0) toast.info("Everything is already up to date");
        else if (failed) toast.warning(`Refreshed ${refreshed}, ${failed} failed`);
        else toast.success(`Refreshed ${refreshed} keyword${refreshed === 1 ? "" : "s"}`);
      },
      onError: (err) => toast.error(err.message),
      onSettled: () => setRefreshingIds(new Set()),
    }),
  );
  const remove = useMutation(
    trpc.keywords.remove.mutationOptions({
      onSuccess: async (_, { keywordIds }) => {
        await invalidateKeywords();
        await queryClient.invalidateQueries(trpc.apps.tracked.pathFilter());
        toast.success(`Removed ${keywordIds.length} keyword${keywordIds.length === 1 ? "" : "s"}`);
      },
      onError: (err) => toast.error(err.message),
    }),
  );
  const track = useMutation(
    trpc.apps.track.mutationOptions({
      onSuccess: async (a) => {
        await queryClient.invalidateQueries(trpc.apps.pathFilter());
        toast.success(`${a.name} added to My Apps`);
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const actions = useMemo<KeywordTableActions>(
    () => ({
      appId,
      editable: isTracked,
      refreshingIds,
      onOpenRanking: (row) => setRanking({ keywordId: row.id, term: row.term, country: row.country }),
      onRefresh: (ids) => refresh.mutate({ keywordIds: ids }),
      onRemove: (rows) => setPendingRemoval(rows),
      onSuggest: (term) => setSuggest({ open: true, seed: term }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutate is stable
    [appId, isTracked, refreshingIds],
  );

  const trackedTerms = useMemo(
    () => new Set((keywords.data ?? []).filter((k) => k.tracked).map((k) => k.term)),
    [keywords.data],
  );
  const staleCount = keywords.data?.filter((k) => k.stale).length ?? 0;
  const ranked = keywords.data?.filter((k) => k.position != null).length ?? 0;
  const top10 = keywords.data?.filter((k) => k.position != null && k.position <= 10).length ?? 0;
  const refreshing = refresh.isPending || refreshApp.isPending;

  if (app.isError) {
    return (
      <>
        <PageHeader>
          <CountrySelect />
        </PageHeader>
        <Empty className="m-6 border">
          <EmptyHeader>
            <EmptyTitle>Couldn’t load this app</EmptyTitle>
            <EmptyDescription>{app.error.message}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </>
    );
  }

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader>
        {app.data ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <AppIcon src={app.data.iconUrl} name={app.data.name} size={32} />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold">{app.data.name}</p>
              <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                <span className="truncate">{app.data.developer}</span>
                {app.data.rating != null && (
                  <>
                    · <StarIcon className="size-3 fill-current" /> {app.data.rating.toFixed(1)} (
                    {compactNumber(app.data.ratingCount)})
                  </>
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="h-4 w-36" />
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isTracked && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={refreshing || !keywords.data?.length}>
                      <RefreshCwIcon className={cn(refreshing && "animate-spin")} />
                      <span className="hidden lg:inline">Refresh</span>
                      {staleCount > 0 && (
                        <span className="rounded-full bg-amber-400/20 px-1.5 text-xs text-amber-500">
                          {staleCount}
                        </span>
                      )}
                      <ChevronDownIcon className="text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Re-fetch keyword data from the App Store</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={staleCount === 0}
                  onClick={() => refreshApp.mutate({ appId, country, all: false })}
                >
                  Refresh outdated ({staleCount})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => refreshApp.mutate({ appId, country, all: true })}>
                  Refresh all ({keywords.data?.length ?? 0})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <CountrySelect />

          {isTracked ? (
            <>
              <Button className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => setAddOpen(true)}>
                <span className="hidden sm:inline">Add Keywords</span> <PlusIcon />
              </Button>
              <Button
                className="bg-orange-500 text-white hover:bg-orange-400"
                onClick={() => setSuggest({ open: true })}
              >
                <span className="hidden sm:inline">Get Suggestions</span> <LightbulbIcon />
              </Button>
            </>
          ) : (
            app.data && (
              <Button
                className="bg-indigo-600 text-white hover:bg-indigo-500"
                disabled={track.isPending}
                onClick={() => track.mutate({ id: appId, country })}
              >
                {track.isPending ? <Spinner /> : <PlusIcon />} Add to My Apps
              </Button>
            )
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" asChild>
                <a
                  href={app.data?.storeUrl ?? `https://apps.apple.com/${country.toLowerCase()}/app/id${appId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLinkIcon />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open in App Store</TooltipContent>
          </Tooltip>
        </div>
      </PageHeader>

      {app.data && !isTracked && (
        <div className="mx-4 mt-3 flex items-start gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-sm">
          <EyeIcon className="mt-0.5 size-4 shrink-0 text-sky-500" />
          <p>
            You’re viewing a competitor. These are the keywords from your local database where{" "}
            <strong>{app.data.name}</strong> appears in the App Store results. Track more keywords (or explore
            them) to discover more of its rankings.
          </p>
        </div>
      )}

      <KeywordTable
        // Remount per app/storefront/view so selection and filters reset.
        key={`${appId}-${country}-${scope}`}
        data={keywords.data}
        isLoading={app.isLoading || keywords.isLoading}
        actions={actions}
        toolbar={
          <>
            {keywords.data && keywords.data.length > 0 && (
              <span className="text-muted-foreground hidden text-xs md:inline">
                Ranked in {ranked} · Top 10 in {top10}
              </span>
            )}
            {isTracked && (
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={scope}
                onValueChange={(v) => v && void setScope(v === "tracked" ? null : (v as "ranked"))}
              >
                <ToggleGroupItem value="tracked" className="px-3">
                  Tracked
                </ToggleGroupItem>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem value="ranked" className="px-3">
                      All rankings
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>Every cached keyword this app ranks for, tracked or not</TooltipContent>
                </Tooltip>
              </ToggleGroup>
            )}
          </>
        }
        emptyState={
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LightbulbIcon />
              </EmptyMedia>
              <EmptyTitle>
                {scope === "tracked" ? "No keywords tracked in this storefront" : "No rankings found yet"}
              </EmptyTitle>
              <EmptyDescription>
                {scope === "tracked"
                  ? "Add keywords manually or let us suggest some based on the app and its competitors."
                  : "This app doesn’t appear in any keyword cached for this storefront yet."}
              </EmptyDescription>
            </EmptyHeader>
            {isTracked && scope === "tracked" && (
              <EmptyContent className="flex-row justify-center">
                <Button className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => setAddOpen(true)}>
                  Add Keywords <PlusIcon />
                </Button>
                <Button
                  className="bg-orange-500 text-white hover:bg-orange-400"
                  onClick={() => setSuggest({ open: true })}
                >
                  Get Suggestions <LightbulbIcon />
                </Button>
              </EmptyContent>
            )}
          </Empty>
        }
      />

      {isTracked && app.data && (
        <>
          <AddKeywordsDialog
            appId={appId}
            country={country}
            open={addOpen}
            onOpenChange={setAddOpen}
            existingTerms={trackedTerms}
          />
          <SuggestionsDialog
            appId={appId}
            appName={app.data.name}
            country={country}
            open={suggest.open}
            seed={suggest.seed}
            onOpenChange={(open) => setSuggest((s) => ({ ...s, open }))}
          />
        </>
      )}

      <RankingSheet target={ranking} highlightAppId={appId} onOpenChange={(o) => !o && setRanking(null)} />

      <AlertDialog open={!!pendingRemoval} onOpenChange={(o) => !o && setPendingRemoval(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {pendingRemoval?.length === 1 ? `“${pendingRemoval[0].term}”` : `${pendingRemoval?.length} keywords`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They’ll stop being tracked for this app. Cached ranking history is kept, so re-adding them is
              instant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingRemoval) remove.mutate({ appId, keywordIds: pendingRemoval.map((k) => k.id) });
                setPendingRemoval(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
