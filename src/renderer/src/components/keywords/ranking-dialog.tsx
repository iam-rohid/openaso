import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ScoreBar } from "@/components/shared/score-bar";
import { Sparkline } from "@/components/shared/sparkline";
import { CompetitorKeywordsDialog, type CompetitorApp } from "./competitor-keywords-dialog";
import { RankedAppRow } from "./ranked-app-row";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { countryFlag, type CountryCode } from "@shared/countries";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/react";

export type RankingTarget = { keywordId: number; term: string; country: string };

type HistoryMetric = "position" | "popularity" | "difficulty";
const HISTORY_METRICS: { id: HistoryMetric; label: string }[] = [
  { id: "position", label: "Position" },
  { id: "popularity", label: "Popularity" },
  { id: "difficulty", label: "Difficulty" },
];

/**
 * Full App Store ranking for a keyword. Any app's ranked keywords can be opened
 * as suggestions to add to a tracked app, which is how you dig into competitors.
 */
export function RankingDialog({
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
  const metrics = highlightAppId ? HISTORY_METRICS : HISTORY_METRICS.filter((m) => m.id !== "position");
  const [metricId, setMetricId] = useState<HistoryMetric>(highlightAppId ? "position" : "popularity");
  const metric = metrics.find((m) => m.id === metricId) ?? metrics[0];

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
  const tracked = useQuery(trpc.apps.tracked.queryOptions());
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
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open) setFilter("");
        onOpenChange(open);
      }}
    >
      <DialogContent className="flex h-[85svh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="truncate">{target?.term}</span>
            <span className="text-muted-foreground text-sm font-normal">
              {target && countryFlag(target.country)} {target?.country}
            </span>
          </DialogTitle>
          <DialogDescription>
            App Store search results · updated {timeAgo(keyword?.lastFetchedAt)}
          </DialogDescription>

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
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <span>History</span>
                {metrics.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={cn("hover:text-foreground", m.id === metric.id && "text-foreground font-medium")}
                    onClick={() => setMetricId(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Sparkline
                      width={160}
                      values={(history.data ?? []).map((h) => (h ? h[metric.id] : undefined))}
                      invert={metric.id === "position"}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {metric.id === "position" ? "Your daily position" : `Daily ${metric.label.toLowerCase()}`} over
                  the last 90 days
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
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="p-2">
            {ranking.isLoading &&
              Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="size-10 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-2/5" />
                    <Skeleton className="h-3 w-3/5" />
                  </div>
                </div>
              ))}
            {ranking.isError && <p className="text-destructive p-4 text-sm">{ranking.error.message}</p>}
            {apps.map((app) => (
              <RankedAppRow
                key={app.id}
                app={app}
                term={target?.term ?? ""}
                country={country}
                highlighted={app.id === highlightAppId}
                isTracked={trackedIds.has(app.id)}
                trackPending={track.isPending}
                onViewKeywords={() => setKeywordsOf({ id: app.id, name: app.name, iconUrl: app.iconUrl })}
                onTrack={() => track.mutate({ id: app.id, country })}
              />
            ))}
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
      </DialogContent>
    </Dialog>
  );
}
