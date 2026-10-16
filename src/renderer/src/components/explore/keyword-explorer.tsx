import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon, CompassIcon, PlusIcon, RefreshCwIcon, SearchIcon } from "lucide-react";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CompetitorKeywordsDialog, type CompetitorApp } from "@/components/keywords/competitor-keywords-dialog";
import { RankedAppRow } from "@/components/keywords/ranked-app-row";
import { RankingSheet, type RankingTarget } from "@/components/keywords/ranking-sheet";
import { PageHeader } from "@/components/layout/page-header";
import { AppIcon } from "@/components/shared/app-icon";
import { CountrySelect } from "@/components/shared/country-select";
import { ScoreBar } from "@/components/shared/score-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCountry } from "@/hooks/use-country";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { countryFlag } from "@shared/countries";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/react";

const route = getRouteApi("/explore");

export function KeywordExplorer() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [country] = useCountry();
  const term = route.useSearch({ select: (s) => s.q ?? "" });
  const navigate = route.useNavigate();
  const setTerm = (q: string) => navigate({ search: (prev) => ({ ...prev, q: q || undefined }), replace: true });
  const [input, setInput] = useState(term);
  const [ranking, setRanking] = useState<RankingTarget | null>(null);
  const [keywordsOf, setKeywordsOf] = useState<CompetitorApp | null>(null);
  // Keep the input in sync when the URL term changes (back/forward, chip clicks).
  const [syncedTerm, setSyncedTerm] = useState(term);
  if (syncedTerm !== term) {
    setSyncedTerm(term);
    setInput(term);
  }

  const typed = useDebouncedValue(input.trim().toLowerCase(), 250);
  const hints = useQuery({
    ...trpc.keywords.hints.queryOptions({ term: typed || term, country }),
    enabled: (typed || term).length > 1,
    staleTime: 10 * 60 * 1000,
  });

  const keyword = useQuery({
    ...trpc.keywords.explore.queryOptions({ term, country }),
    enabled: term.length > 0,
  });
  const rankingData = useQuery({
    ...trpc.keywords.ranking.queryOptions({ keywordId: keyword.data?.id ?? 0, limit: 10 }),
    enabled: !!keyword.data,
  });
  const recent = useQuery(trpc.keywords.recent.queryOptions({ country }));
  const tracked = useQuery(trpc.apps.tracked.queryOptions({ country }));
  const trackedIds = new Set(tracked.data?.map((a) => a.id));

  const refresh = useMutation(
    trpc.keywords.refresh.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.keywords.pathFilter());
        toast.success("Keyword refreshed");
      },
      onError: (err) => toast.error(err.message),
    }),
  );
  const add = useMutation(
    trpc.keywords.add.mutationOptions({
      onSuccess: async (_, { appId }) => {
        await queryClient.invalidateQueries(trpc.keywords.pathFilter());
        await queryClient.invalidateQueries(trpc.apps.tracked.pathFilter());
        const app = tracked.data?.find((a) => a.id === appId);
        toast.success(`Now tracking “${term}” for ${app?.name ?? "app"}`);
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const track = useMutation(
    trpc.apps.track.mutationOptions({
      onSuccess: async (app) => {
        await queryClient.invalidateQueries(trpc.apps.tracked.pathFilter());
        toast.success(`${app.name} added to My Apps`);
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const search = (value: string) => {
    const next = value.trim().toLowerCase();
    if (next) void setTerm(next);
  };

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader>
        <h1 className="text-sm font-semibold">Keyword Explorer</h1>
        <div className="ml-auto">
          <CountrySelect />
        </div>
      </PageHeader>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            search(input);
          }}
          className="space-y-3"
        >
          <InputGroup className="h-11">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              autoFocus
              className="text-base"
              placeholder={`Look up any keyword in the ${countryFlag(country)} ${country} App Store…`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton type="submit" variant="default" disabled={!input.trim()}>
                Explore
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {(hints.data?.length ?? 0) > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground mr-1 text-xs">Autocomplete:</span>
              {hints.data!.map((h) => (
                <Button
                  key={h}
                  type="button"
                  size="xs"
                  variant={h === term ? "default" : "secondary"}
                  onClick={() => {
                    setInput(h);
                    search(h);
                  }}
                >
                  {h}
                </Button>
              ))}
            </div>
          )}
        </form>

        {term && (
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl">{term}</CardTitle>
                <CardDescription>
                  {countryFlag(country)} {country} · updated {timeAgo(keyword.data?.lastFetchedAt)}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!keyword.data || refresh.isPending}
                  onClick={() => keyword.data && refresh.mutate({ keywordIds: [keyword.data.id] })}
                >
                  <RefreshCwIcon className={cn(refresh.isPending && "animate-spin")} /> Refresh
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      className="bg-indigo-600 text-white hover:bg-indigo-500"
                      disabled={!keyword.data || add.isPending}
                    >
                      {add.isPending ? <Spinner /> : <PlusIcon />} Track for app <ChevronDownIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>Add “{term}” to…</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {tracked.data?.length === 0 && (
                      <p className="text-muted-foreground px-2 py-1.5 text-sm">Add an app first.</p>
                    )}
                    {tracked.data?.map((app) => (
                      <DropdownMenuItem
                        key={app.id}
                        onClick={() => add.mutate({ appId: app.id, country, terms: [term] })}
                      >
                        <AppIcon src={app.iconUrl} name={app.name} size={20} />
                        <span className="truncate">{app.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {keyword.isError && <p className="text-destructive text-sm">{keyword.error.message}</p>}
              <div className="grid gap-6 sm:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs font-medium uppercase">Popularity</p>
                  {keyword.data ? <ScoreBar value={keyword.data.popularity} /> : <Skeleton className="h-5" />}
                </div>
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs font-medium uppercase">Difficulty</p>
                  {keyword.data ? (
                    <ScoreBar value={keyword.data.difficulty} inverse />
                  ) : (
                    <Skeleton className="h-5" />
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs font-medium uppercase">Apps in results</p>
                  {keyword.data ? (
                    <p className="text-lg font-semibold tabular-nums">{keyword.data.resultCount}</p>
                  ) : (
                    <Skeleton className="h-5" />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Top results</p>
                  {keyword.data && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRanking({ keywordId: keyword.data.id, term, country })}
                    >
                      View all {keyword.data.resultCount}
                    </Button>
                  )}
                </div>
                <div className="rounded-xl border p-2">
                  {(keyword.isLoading || rankingData.isLoading) &&
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-2">
                        <Skeleton className="size-10 rounded-xl" />
                        <Skeleton className="h-4 w-1/3" />
                      </div>
                    ))}
                  {rankingData.data?.apps.slice(0, 10).map((app) => (
                    <RankedAppRow
                      key={app.id}
                      app={app}
                      term={term}
                      country={country}
                      isTracked={trackedIds.has(app.id)}
                      trackPending={track.isPending}
                      onViewKeywords={() => setKeywordsOf({ id: app.id, name: app.name, iconUrl: app.iconUrl })}
                      onTrack={() => track.mutate({ id: app.id, country })}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!term && (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CompassIcon />
              </EmptyMedia>
              <EmptyTitle>Research any keyword</EmptyTitle>
              <EmptyDescription>
                See estimated popularity, difficulty and the full App Store ranking without tracking it. Results
                are cached locally, so repeat lookups are instant.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {(recent.data?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium">Cached keywords in {country}</h2>
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead className="w-40">Popularity</TableHead>
                    <TableHead className="w-40">Difficulty</TableHead>
                    <TableHead className="w-20">Results</TableHead>
                    <TableHead className="w-32">Last update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.data!.map((k) => (
                    <TableRow key={k.id} className="cursor-pointer" onClick={() => search(k.term)}>
                      <TableCell className="font-medium">{k.term}</TableCell>
                      <TableCell>
                        <ScoreBar value={k.popularity} />
                      </TableCell>
                      <TableCell>
                        <ScoreBar value={k.difficulty} inverse />
                      </TableCell>
                      <TableCell className="tabular-nums">{k.resultCount}</TableCell>
                      <TableCell className="text-muted-foreground">{timeAgo(k.lastFetchedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </main>

      <RankingSheet target={ranking} onOpenChange={(o) => !o && setRanking(null)} />
      <CompetitorKeywordsDialog
        competitor={keywordsOf}
        country={country}
        onOpenChange={(open) => !open && setKeywordsOf(null)}
      />
    </div>
  );
}
