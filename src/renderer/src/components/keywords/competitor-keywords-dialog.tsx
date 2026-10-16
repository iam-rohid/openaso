import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ListFilterIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppIcon } from "@/components/shared/app-icon";
import { ScoreBar } from "@/components/shared/score-bar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { countryFlag, type CountryCode } from "@shared/countries";
import { cn } from "@/lib/utils";
import { storefrontSuffix } from "@/lib/format";
import { useTRPC } from "@/trpc/react";

export type CompetitorApp = { id: string; name: string; iconUrl: string | null };

type SortKey = "term" | "position" | "popularity" | "difficulty" | "resultCount";
type Filters = { hideAdded: boolean; minPopularity: string; maxDifficulty: string; maxRank: string };

const DEFAULT_FILTERS: Filters = { hideAdded: true, minPopularity: "", maxDifficulty: "", maxRank: "" };
// Sorting by these puts the best values first, so the first click sorts ascending.
const ASCENDING_FIRST: SortKey[] = ["term", "position", "difficulty", "resultCount"];

const toLimit = (value: string) => (value.trim() === "" ? null : Number(value));

/**
 * Keywords a competitor ranks for (from the local cache), offered as suggestions
 * to add to one of the tracked apps.
 */
export function CompetitorKeywordsDialog({
  competitor,
  country,
  defaultTargetAppId,
  onOpenChange,
}: {
  competitor: CompetitorApp | null;
  country: CountryCode;
  defaultTargetAppId?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const open = !!competitor;

  // `undefined` until the user picks, so the default can resolve once tracked apps load.
  const [pickedTarget, setPickedTarget] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "popularity", desc: true });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Added while the dialog is open: kept visible as "Added" even when hiding added keywords.
  const [addedNow, setAddedNow] = useState<Set<number>>(new Set());

  // Reset local state whenever a different competitor is opened.
  const [openedFor, setOpenedFor] = useState(competitor?.id);
  if (openedFor !== competitor?.id) {
    setOpenedFor(competitor?.id);
    setPickedTarget(undefined);
    setSearch("");
    setFilters(DEFAULT_FILTERS);
    setSort({ key: "popularity", desc: true });
    setSelected(new Set());
    setAddedNow(new Set());
  }

  const trackedApps = useQuery({ ...trpc.apps.tracked.queryOptions(), enabled: open });
  const targets = (trackedApps.data ?? []).filter((a) => a.id !== competitor?.id);
  const targetId =
    pickedTarget ?? (targets.some((a) => a.id === defaultTargetAppId) ? defaultTargetAppId : undefined);
  const target = targets.find((a) => a.id === targetId);

  const ranked = useQuery({
    ...trpc.keywords.list.queryOptions({ appId: competitor?.id ?? "0", country, scope: "ranked" }),
    enabled: open,
  });
  const targetKeywords = useQuery({
    ...trpc.keywords.list.queryOptions({ appId: targetId ?? "0", country, scope: "tracked" }),
    enabled: open && !!targetId,
  });
  const targetKeywordIds = useMemo(() => new Set(targetKeywords.data?.map((k) => k.id)), [targetKeywords.data]);

  const discover = useMutation(
    trpc.keywords.discover.mutationOptions({
      onSuccess: async ({ checked, ranked: found }) => {
        await queryClient.invalidateQueries(trpc.keywords.list.pathFilter());
        toast.success(`Checked ${checked} keywords — ranks for ${found}`);
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const add = useMutation(
    trpc.keywords.add.mutationOptions({
      onSuccess: async ({ added, failed }, { terms }) => {
        const ids = (ranked.data ?? []).filter((k) => terms.includes(k.term)).map((k) => k.id);
        setAddedNow((prev) => new Set([...prev, ...ids]));
        setSelected(new Set());
        await queryClient.invalidateQueries(trpc.keywords.pathFilter());
        await queryClient.invalidateQueries(trpc.apps.tracked.pathFilter());
        const to = target ? ` to ${target.name}${storefrontSuffix(target.country, country)}` : "";
        if (failed.length) toast.warning(`Added ${added}${to}; failed: ${failed.join(", ")}`);
        else toast.success(`Added ${added} keyword${added === 1 ? "" : "s"}${to}`);
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const isAdded = (id: number) => targetKeywordIds.has(id) || addedNow.has(id);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const minPopularity = toLimit(filters.minPopularity);
    const maxDifficulty = toLimit(filters.maxDifficulty);
    const maxRank = toLimit(filters.maxRank);
    const filtered = (ranked.data ?? []).filter(
      (k) =>
        (!q || k.term.includes(q)) &&
        !(filters.hideAdded && targetKeywordIds.has(k.id) && !addedNow.has(k.id)) &&
        (minPopularity == null || (k.popularity ?? 0) >= minPopularity) &&
        (maxDifficulty == null || (k.difficulty ?? 100) <= maxDifficulty) &&
        (maxRank == null || (k.position != null && k.position <= maxRank)),
    );
    const dir = sort.desc ? -1 : 1;
    return filtered.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      // Missing values always sort last.
      if (av == null) return bv == null ? 0 : 1;
      if (bv == null) return -1;
      return (typeof av === "string" ? av.localeCompare(bv as string) : av - (bv as number)) * dir;
    });
  }, [ranked.data, search, filters, sort, targetKeywordIds, addedNow]);

  const allAdded = !!ranked.data?.length && ranked.data.every((k) => targetKeywordIds.has(k.id));
  const addable = rows.filter((k) => !isAdded(k.id));
  const selectedTerms = addable.filter((k) => selected.has(k.id)).map((k) => k.term);
  const activeFilters =
    (filters.hideAdded ? 0 : 1) + [filters.minPopularity, filters.maxDifficulty, filters.maxRank].filter(Boolean).length;

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const sortBy = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: !ASCENDING_FIRST.includes(key) }));

  const header = (key: SortKey, label: string, className?: string) => {
    const Icon = sort.key !== key ? ArrowUpDownIcon : sort.desc ? ArrowDownIcon : ArrowUpIcon;
    return (
      <button
        type="button"
        onClick={() => sortBy(key)}
        className={cn(
          "hover:text-foreground inline-flex items-center gap-1 text-left",
          sort.key === key && "text-foreground",
          className,
        )}
      >
        {label}
        <Icon className={cn("size-3", sort.key !== key && "opacity-40")} />
      </button>
    );
  };

  const discoverButton = (label: string) => (
    <Button
      variant="outline"
      size="sm"
      disabled={!competitor || discover.isPending}
      onClick={() => competitor && discover.mutate({ appId: competitor.id, country })}
    >
      {discover.isPending ? <Spinner /> : <SparklesIcon />}
      {discover.isPending ? "Checking keywords…" : label}
    </Button>
  );

  const grid = "grid grid-cols-[2rem_minmax(0,1fr)_3.5rem_8rem] items-center gap-3 sm:grid-cols-[2rem_minmax(0,1fr)_3.5rem_9rem_9rem_5rem]";

  return (
    <Dialog open={open} onOpenChange={(o) => !add.isPending && onOpenChange(o)}>
      <DialogContent className="flex max-h-[85svh] flex-col gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="flex-row flex-wrap items-start gap-3 border-b p-4 pr-12">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {competitor && <AppIcon src={competitor.iconUrl} name={competitor.name} size={40} />}
            <div className="min-w-0 space-y-1">
              <DialogTitle>Keyword Suggestions</DialogTitle>
              <DialogDescription>
                Ranked keywords of <span className="text-foreground font-medium">{competitor?.name}</span>
                {target && (
                  <>
                    {" "}
                    · adding to <span className="text-foreground font-medium">{target.name}</span>
                  </>
                )}{" "}
                · {countryFlag(country)} {country}
              </DialogDescription>
            </div>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            {!!ranked.data?.length && discoverButton("Discover more")}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="relative" aria-label="Filters">
                  <ListFilterIcon />
                  {activeFilters > 0 && (
                    <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 rounded-full px-1 text-[10px]">
                      {activeFilters}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 space-y-3">
                <Label className="flex items-center gap-2 font-normal">
                  <Checkbox
                    checked={filters.hideAdded}
                    onCheckedChange={(v) => setFilters((f) => ({ ...f, hideAdded: !!v }))}
                  />
                  Hide already added
                </Label>
                {(
                  [
                    ["minPopularity", "Min popularity"],
                    ["maxDifficulty", "Max difficulty"],
                    ["maxRank", "Max competitor rank"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <Label htmlFor={`ckd-${key}`} className="font-normal">
                      {label}
                    </Label>
                    <Input
                      id={`ckd-${key}`}
                      type="number"
                      min={key === "maxRank" ? 1 : 0}
                      max={key === "maxRank" ? 250 : 100}
                      placeholder="Any"
                      className="h-8 w-20"
                      value={filters[key]}
                      onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  disabled={activeFilters === 0}
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                >
                  Reset filters
                </Button>
              </PopoverContent>
            </Popover>
            <InputGroup className="flex-1 sm:w-56">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search keywords"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>
          </div>
        </DialogHeader>

        <div className={cn(grid, "text-muted-foreground border-b px-4 py-2 text-xs font-medium")}>
          <span>Select</span>
          {header("term", "Keyword")}
          {header("position", "Rank")}
          {header("popularity", "Popularity")}
          {header("difficulty", "Difficulty", "hidden sm:inline-flex")}
          {header("resultCount", "Apps", "hidden sm:inline-flex")}
        </div>

        <div className="min-h-[280px] flex-1 overflow-y-auto p-2">
          {ranked.isLoading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={cn(grid, "px-2 py-2.5")}>
                <Skeleton className="size-4" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4" />
              </div>
            ))}
          {ranked.isError && <p className="text-destructive p-4 text-sm">{ranked.error.message}</p>}
          {ranked.data?.length === 0 && (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <p className="font-medium">No cached keywords for this app yet</p>
              <p className="text-muted-foreground max-w-sm text-sm">
                Check likely keywords from its title, App Store autocomplete and similar apps. This can take
                up to half a minute.
              </p>
              {discoverButton("Discover keywords")}
            </div>
          )}
          {!!ranked.data?.length && rows.length === 0 && (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <p className="text-muted-foreground text-sm">
                {allAdded
                  ? `All ${ranked.data.length} cached keywords are already in ${target?.name}.`
                  : "No keywords match your search or filters."}
              </p>
              {allAdded && discoverButton("Discover more")}
            </div>
          )}
          {rows.map((k) => {
            const added = isAdded(k.id);
            return (
              <label
                key={k.id}
                className={cn(
                  grid,
                  "rounded-lg px-2 py-2 text-sm odd:bg-muted/40",
                  added ? "text-muted-foreground" : "hover:bg-muted cursor-pointer",
                )}
              >
                <Checkbox
                  checked={added || selected.has(k.id)}
                  disabled={added || !targetId}
                  onCheckedChange={() => toggle(k.id)}
                />
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">{k.term}</span>
                  {added && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 text-[10px] text-emerald-500">
                      <CheckIcon className="size-3" /> Added
                    </span>
                  )}
                </span>
                <span className="tabular-nums">{k.position != null ? `#${k.position}` : "—"}</span>
                <ScoreBar value={k.popularity} />
                <ScoreBar value={k.difficulty} inverse className="hidden sm:flex" />
                <span className="hidden tabular-nums sm:inline">{k.resultCount ?? "—"}</span>
              </label>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t p-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Add to</span>
            {targets.length > 0 ? (
              <Select
                value={targetId ?? ""}
                onValueChange={(id) => {
                  setPickedTarget(id);
                  setSelected(new Set());
                  setAddedNow(new Set());
                }}
              >
                <SelectTrigger size="sm" className="w-48">
                  <SelectValue placeholder="Choose an app" />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <AppIcon src={a.iconUrl} name={a.name} size={16} />
                      <span className="truncate">{a.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-muted-foreground">
                {trackedApps.isLoading ? "…" : "Add an app to My Apps to save keywords"}
              </span>
            )}
          </div>
          <span className="text-muted-foreground text-sm tabular-nums">
            <span className="text-foreground font-medium">{selectedTerms.length}</span> / {addable.length} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={!targetId || addable.length === 0}
              onClick={() => setSelected(new Set(addable.map((k) => k.id)))}
            >
              Select All ({addable.length})
            </Button>
            <Button variant="secondary" disabled={add.isPending} onClick={() => onOpenChange(false)}>
              Done
            </Button>
            <Button
              className="bg-blue-600 text-white hover:bg-blue-500"
              disabled={!targetId || selectedTerms.length === 0 || add.isPending}
              onClick={() => targetId && add.mutate({ appId: targetId, country, terms: selectedTerms })}
            >
              {add.isPending && <Spinner />}
              {add.isPending ? "Adding…" : "Add Selected"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
