"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLinkIcon, KeyRoundIcon, PlusIcon, RefreshCwIcon, SearchIcon, StarIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppIcon } from "@/components/shared/app-icon";
import { ScoreBar } from "@/components/shared/score-bar";
import { Sparkline } from "@/components/shared/sparkline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { withCountry } from "@/hooks/use-country";
import { countryFlag, type CountryCode } from "@/lib/countries";
import { compactNumber, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/react";

export type RankingTarget = { keywordId: number; term: string; country: string };

/**
 * Full App Store ranking for a keyword. Every app links to its own keyword view,
 * which is how you dig into competitors' keywords.
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

  const ranking = useQuery({
    ...trpc.keywords.ranking.queryOptions({ keywordId: target?.keywordId ?? 0 }),
    enabled: !!target,
  });
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
    return q ? list.filter((a) => `${a.name} ${a.developer}`.toLowerCase().includes(q)) : list;
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
                placeholder={`Filter ${ranking.data?.apps.length ?? ""} apps…`}
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
                    <Skeleton className="h-3 w-1/3" />
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
                    "group hover:bg-muted/60 flex items-center gap-3 rounded-lg p-2",
                    app.id === highlightAppId && "bg-primary/10 hover:bg-primary/15",
                  )}
                >
                  <span className="text-muted-foreground w-8 text-right text-sm tabular-nums">{app.position}</span>
                  <AppIcon src={app.iconUrl} name={app.name} size={40} />
                  <Link
                    href={withCountry(`/apps/${app.id}`, country)}
                    onClick={() => onOpenChange(false)}
                    className="min-w-0 flex-1"
                  >
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                      <span className="truncate">{app.name}</span>
                      {app.titleMatch && (
                        <Badge variant="secondary" className="h-4 shrink-0 px-1 text-[10px]">
                          title match
                        </Badge>
                      )}
                    </p>
                    <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                      <span className="truncate">{app.developer}</span>
                      {app.rating != null && !!app.ratingCount && (
                        <>
                          <span>·</span>
                          <StarIcon className="size-3 shrink-0 fill-current" />
                          <span className="shrink-0">
                            {app.rating.toFixed(1)} ({compactNumber(app.ratingCount)})
                          </span>
                        </>
                      )}
                    </p>
                  </Link>
                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon-sm" asChild>
                          <Link href={withCountry(`/apps/${app.id}`, country)} onClick={() => onOpenChange(false)}>
                            <KeyRoundIcon />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View keywords</TooltipContent>
                    </Tooltip>
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon-sm" asChild>
                          <a
                            href={app.storeUrl ?? `https://apps.apple.com/${country.toLowerCase()}/app/id${app.id}`}
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
                </div>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
