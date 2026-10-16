import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDownIcon,
  LightbulbIcon,
  PlusIcon,
  RefreshCwIcon,
  StarIcon,
} from "lucide-react";
import { Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { TemporaryAppMenu } from "@/components/apps/temporary-app-menu";
import { AddKeywordsDialog } from "@/components/keywords/add-keywords-dialog";
import { KeywordColumnsMenu } from "@/components/keywords/keyword-columns-menu";
import { KeywordSearch } from "@/components/keywords/keyword-search";
import { KeywordTable } from "@/components/keywords/keyword-table";
import type { KeywordRow, KeywordTableActions } from "@/components/keywords/keyword-table-features";
import { RankingSheet, type RankingTarget } from "@/components/keywords/ranking-sheet";
import { SuggestionsDialog } from "@/components/keywords/suggestions-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { AppIcon } from "@/components/shared/app-icon";
import { AppLinksMenu } from "@/components/shared/app-links-menu";
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
import { Badge } from "@/components/ui/badge";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { compactNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/react";
import { DEFAULT_COUNTRY, type CountryCode } from "@shared/countries";

export function AppKeywordsView({ appId }: { appId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [suggest, setSuggest] = useState<{ open: boolean; seed?: string }>({ open: false });
  const [ranking, setRanking] = useState<RankingTarget | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<KeywordRow[] | null>(null);
  const [refreshingIds, setRefreshingIds] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState("");
  // While the search box is open, header buttons shrink to icons to make room for it.
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchOpen = searchExpanded || filter.length > 0;

  const appQuery = trpc.apps.get.queryOptions({ id: appId });
  const app = useQuery(appQuery);
  // Each app is viewed in its own storefront, saved with the app.
  const country = app.data?.storefront ?? DEFAULT_COUNTRY;
  const setCountry = useMutation(
    trpc.apps.setCountry.mutationOptions({
      // Switch immediately; the app's metadata refetches for the new storefront below.
      onMutate: ({ country }) => {
        queryClient.setQueryData(appQuery.queryKey, (prev) => prev && { ...prev, storefront: country });
      },
      onSettled: () =>
        Promise.all([
          queryClient.invalidateQueries(trpc.apps.pathFilter()),
          queryClient.invalidateQueries(trpc.folders.pathFilter()),
        ]),
      onError: (err) => toast.error(err.message),
    }),
  );
  const onCountryChange = (code: CountryCode) => setCountry.mutate({ id: appId, country: code });
  // Only apps in My Apps get this page; competitors are explored from the ranking views.
  const isTracked = app.data?.isTracked ?? false;
  // Not on the App Store yet, so there's nothing to rank or link to.
  const isTemporary = app.data?.isTemporary ?? false;

  const keywords = useQuery({
    ...trpc.keywords.list.queryOptions({ appId, country, scope: "tracked" }),
    enabled: isTracked,
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


  const actions = useMemo<KeywordTableActions>(
    () => ({
      appId,
      editable: true,
      refreshingIds,
      onOpenRanking: (row) => setRanking({ keywordId: row.id, term: row.term, country: row.country }),
      onRefresh: (ids) => refresh.mutate({ keywordIds: ids }),
      onRemove: (rows) => setPendingRemoval(rows),
      onSuggest: (term) => setSuggest({ open: true, seed: term }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutate is stable
    [appId, refreshingIds],
  );

  const trackedTerms = useMemo(
    () => new Set((keywords.data ?? []).filter((k) => k.tracked).map((k) => k.term)),
    [keywords.data],
  );
  const staleCount = keywords.data?.filter((k) => k.stale).length ?? 0;
  const ranked = keywords.data?.filter((k) => k.position != null).length ?? 0;
  const top10 = keywords.data?.filter((k) => k.position != null && k.position <= 10).length ?? 0;
  const refreshing = refresh.isPending || refreshApp.isPending;

  if (app.data && !isTracked) return <Navigate to="/" />;

  if (app.isError) {
    return (
      <>
        <PageHeader>
          <CountrySelect value={country} onChange={onCountryChange} />
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
    <div className="flex h-svh flex-col">
      <PageHeader>
        {app.data ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <AppIcon src={app.data.iconUrl} name={app.data.name} size={32} />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold">{app.data.name}</p>
              <p className="text-muted-foreground flex items-center gap-1 truncate text-xs tabular-nums">
                {app.data.isTemporary && (
                  <Badge variant="outline" className="text-muted-foreground h-4 px-1.5 text-[10px]">
                    Temporary
                  </Badge>
                )}
                {app.data.rating != null && (
                  <>
                    <StarIcon className="size-3 shrink-0 fill-current" /> {app.data.rating.toFixed(1)} (
                    {compactNumber(app.data.ratingCount)})
                  </>
                )}
                {app.data.isTemporary ? null : keywords.data ? (
                  keywords.data.length > 0 && (
                    <span className="truncate">
                      {app.data.rating != null && "· "}Ranked in {ranked} · Top 10 in {top10}
                    </span>
                  )
                ) : (
                  <Skeleton className="h-3 w-24" />
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
                      <span className={cn("hidden", !searchOpen && "lg:inline")}>Refresh</span>
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

          <CountrySelect value={country} onChange={onCountryChange} compact={searchOpen} />

          {isTracked && (
            <>
              <Button
                size={searchOpen ? "icon" : "default"}
                className="bg-indigo-600 text-white hover:bg-indigo-500"
                onClick={() => setAddOpen(true)}
              >
                <span className={cn(searchOpen ? "sr-only" : "hidden sm:inline")}>Add Keywords</span> <PlusIcon />
              </Button>
              <Button
                size={searchOpen ? "icon" : "default"}
                className="bg-orange-500 text-white hover:bg-orange-400"
                onClick={() => setSuggest({ open: true })}
              >
                <span className={cn(searchOpen ? "sr-only" : "hidden sm:inline")}>Get Suggestions</span>{" "}
                <LightbulbIcon />
              </Button>
            </>
          )}
          <KeywordColumnsMenu hideRankColumns={isTemporary} />
          {app.data?.isTemporary ? (
            <TemporaryAppMenu app={{ ...app.data, country }} />
          ) : (
            <AppLinksMenu appId={appId} country={country} storeUrl={app.data?.storeUrl} size="icon" variant="outline" />
          )}
          <KeywordSearch
            value={filter}
            onChange={setFilter}
            expanded={searchExpanded}
            onExpandedChange={setSearchExpanded}
          />
        </div>
      </PageHeader>

      <KeywordTable
        // Remount per app/storefront so selection resets.
        key={`${appId}-${country}`}
        data={keywords.data}
        isLoading={app.isLoading || keywords.isLoading}
        actions={actions}
        globalFilter={filter}
        hideRankColumns={isTemporary}
        emptyState={
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LightbulbIcon />
              </EmptyMedia>
              <EmptyTitle>No keywords tracked in this storefront</EmptyTitle>
              <EmptyDescription>
                Add keywords manually or let us suggest some based on the app and its competitors.
              </EmptyDescription>
            </EmptyHeader>
            {isTracked && (
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
