"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarIcon, EyeIcon, PlusIcon, RefreshCwIcon, SearchIcon, StarIcon } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppIcon } from "@/components/shared/app-icon";
import { AppLinksMenu } from "@/components/shared/app-links-menu";
import { ScoreBar } from "@/components/shared/score-bar";
import { Sparkline } from "@/components/shared/sparkline";
import { CompetitorKeywordsDialog, type CompetitorApp } from "./competitor-keywords-dialog";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { countryFlag, type CountryCode } from "@/lib/countries";
import { compactNumber, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/react";

export type RankingTarget = { keywordId: number; term: string; country: string };

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Marks where the keyword appears in `text`: the whole phrase strongly, any of its
 * words on their own more softly. Matches whole words only, ignoring case.
 */
function Highlight({ text, term }: { text: string; term: string }) {
  const phrase = term.trim().toLowerCase();
  const words = [...new Set(phrase.split(/\s+/).filter(Boolean))];
  if (words.length === 0) return text;

  const alternatives = [...new Set([phrase, ...words])].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(${alternatives.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}])`,
    "giu",
  );
  return text.split(pattern).map((part, i) =>
    i % 2 === 0 ? (
      <Fragment key={i}>{part}</Fragment>
    ) : (
      <mark
        key={i}
        className={cn(
          "rounded-[3px] px-0.5 text-inherit",
          part.toLowerCase() === phrase ? "bg-amber-400/40" : "bg-amber-400/15",
        )}
      >
        {part}
      </mark>
    ),
  );
}

const releaseFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

/**
 * Full App Store ranking for a keyword. Any app's ranked keywords can be opened
 * as suggestions to add to a tracked app, which is how you dig into competitors.
 */
export function RankingSheet({
  target,
  highlightAppId,
  onOpenChange,
}: {
  target: RankingTarget | null;
  highlightAppId?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");
  const [keywordsOf, setKeywordsOf] = useState<CompetitorApp | null>(null);

  // The top results come back fast; the full list may need metadata lookups for
  // ~250 apps on first open, so show the preview until it arrives.
  const preview = useQuery({
    ...trpc.keywords.ranking.queryOptions({ keywordId: target?.keywordId ?? 0, limit: 25 }),
    enabled: !!target,
  });
  const full = useQuery({
    ...trpc.keywords.ranking.queryOptions({ keywordId: target?.keywordId ?? 0 }),
    enabled: !!target,
  });
  const ranking = full.data ? full : preview;
  const loadingRest = !full.data && full.isFetching;
  const history = useQuery({
    ...trpc.keywords.history.queryOptions({
      keywordId: target?.keywordId ?? 0,
      appId: highlightAppId ?? null,
    }),
    enabled: !!target,
  });
  const tracked = useQuery(trpc.apps.tracked.queryOptions({ country: (target?.country ?? "US") as CountryCode }));
  const trackedIds = new Set(tracked.data?.map((a) => a.id));

  const refresh = useMutation(
    trpc.keywords.refresh.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.keywords.pathFilter());
        toast.success("Ranking refreshed");
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

  const apps = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = ranking.data?.apps ?? [];
    return q ? list.filter((a) => `${a.name} ${a.subtitle ?? ""} ${a.developer}`.toLowerCase().includes(q)) : list;
  }, [ranking.data, filter]);

  const keyword = ranking.data?.keyword;
  const country = (target?.country ?? "US") as CountryCode;

  return (
    <Sheet
      open={!!target}
      onOpenChange={(open) => {
        if (!open) setFilter("");
        onOpenChange(open);
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b p-4 pr-12">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <span className="truncate">{target?.term}</span>
            <span className="text-muted-foreground text-sm font-normal">
              {target && countryFlag(target.country)} {target?.country}
            </span>
          </SheetTitle>
          <SheetDescription>
            App Store search results · updated {timeAgo(keyword?.lastFetchedAt)}
          </SheetDescription>

          <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Popularity</p>
              {keyword ? <ScoreBar value={keyword.popularity} /> : <Skeleton className="h-4" />}
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Difficulty</p>
              {keyword ? <ScoreBar value={keyword.difficulty} inverse /> : <Skeleton className="h-4" />}
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">History</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Sparkline
                      width={120}
                      values={
                        highlightAppId
                          ? (history.data ?? []).map((h) => h.position)
                          : (history.data ?? []).map((h) => h.popularity)
                      }
                      invert={!!highlightAppId}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {highlightAppId ? "Your position" : "Popularity"} across {history.data?.length ?? 0} updates
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <InputGroup className="flex-1">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                placeholder={`Filter ${keyword?.resultCount ?? ""} apps…`}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </InputGroup>
            <Button
              variant="outline"
              size="sm"
              disabled={!target || refresh.isPending}
              onClick={() => target && refresh.mutate({ keywordIds: [target.keywordId] })}
            >
              <RefreshCwIcon className={cn(refresh.isPending && "animate-spin")} /> Refresh
            </Button>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="p-2">
            {ranking.isLoading &&
              Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="h-4 w-6" />
                  <Skeleton className="size-10 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-2/5" />
                    <Skeleton className="h-3 w-3/5" />
                  </div>
                </div>
              ))}
            {ranking.isError && <p className="text-destructive p-4 text-sm">{ranking.error.message}</p>}
            {apps.map((app) => {
              const isTracked = trackedIds.has(app.id);
              return (
                <div
                  key={app.id}
                  className={cn(
                    "group hover:bg-muted/60 relative flex items-center gap-3 rounded-lg p-2",
                    app.id === highlightAppId && "bg-primary/10 hover:bg-primary/15",
                  )}
                >
                  <span className="text-muted-foreground w-8 text-right text-sm tabular-nums">{app.position}</span>
                  <AppIcon src={app.iconUrl} name={app.name} size={40} />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-medium" title={app.name}>
                      <Highlight text={app.name} term={target?.term ?? ""} />
                    </p>
                    <p className="truncate text-xs" title={app.subtitle ?? undefined}>
                      {app.subtitle ? (
                        <Highlight text={app.subtitle} term={target?.term ?? ""} />
                      ) : (
                        <span className="text-muted-foreground/60 italic">No subtitle</span>
                      )}
                    </p>
                    <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                      <StarIcon className="size-3 shrink-0 fill-current" />
                      <span className="shrink-0 tabular-nums">
                        {app.rating != null && app.ratingCount ? app.rating.toFixed(1) : "—"}
                      </span>
                      <span>·</span>
                      <span className="shrink-0 tabular-nums">
                        {compactNumber(app.ratingCount ?? 0)} ratings
                      </span>
                      {app.releaseDate && (
                        <>
                          <span>·</span>
                          <CalendarIcon className="size-3 shrink-0" />
                          <span className="shrink-0">{releaseFormat.format(new Date(app.releaseDate))}</span>
                        </>
                      )}
                      {app.developer && (
                        <>
                          <span>·</span>
                          <span className="truncate">{app.developer}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="bg-muted absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-0.5 rounded-md opacity-0 shadow-sm transition-opacity group-hover:opacity-100 has-[[data-state=open]]:opacity-100">
                    {app.id !== highlightAppId && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setKeywordsOf({ id: app.id, name: app.name, iconUrl: app.iconUrl })}
                          >
                            <EyeIcon />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View keywords</TooltipContent>
                      </Tooltip>
                    )}
                    {!isTracked && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={track.isPending}
                            onClick={() => track.mutate({ id: app.id, country })}
                          >
                            <PlusIcon />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Add to My Apps</TooltipContent>
                      </Tooltip>
                    )}
                    <AppLinksMenu appId={app.id} country={country} storeUrl={app.storeUrl} />
                  </div>
                </div>
              );
            })}
            {loadingRest && preview.data && (
              <p className="text-muted-foreground flex items-center justify-center gap-2 p-4 text-sm">
                <RefreshCwIcon className="size-3.5 animate-spin" /> Loading the rest of the ranking…
              </p>
            )}
          </div>
        </div>
        <CompetitorKeywordsDialog
          competitor={keywordsOf}
          country={country}
          defaultTargetAppId={highlightAppId}
          onOpenChange={(open) => !open && setKeywordsOf(null)}
        />
      </SheetContent>
    </Sheet>
  );
}
