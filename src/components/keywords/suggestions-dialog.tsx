"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LightbulbIcon, PlusIcon, RefreshCwIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ScoreBar } from "@/components/shared/score-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { countryFlag, type CountryCode } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/react";

const SOURCE_LABEL: Record<string, string> = {
  title: "Title",
  autocomplete: "Autocomplete",
  competitors: "Competitors",
  description: "Description",
  seed: "Seed",
};

export function SuggestionsDialog({
  appId,
  appName,
  country,
  open,
  seed: initialSeed,
  onOpenChange,
}: {
  appId: string;
  appName: string;
  country: CountryCode;
  open: boolean;
  seed?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [seedInput, setSeedInput] = useState(initialSeed ?? "");
  const [seed, setSeed] = useState(initialSeed);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reset local state each time the dialog opens (possibly with a new seed).
  const [openedWith, setOpenedWith] = useState<{ open: boolean; seed?: string }>({ open, seed: initialSeed });
  if (openedWith.open !== open || openedWith.seed !== initialSeed) {
    setOpenedWith({ open, seed: initialSeed });
    if (open) {
      setSeed(initialSeed);
      setSeedInput(initialSeed ?? "");
      setSelected(new Set());
    }
  }

  const suggestions = useQuery({
    ...trpc.keywords.suggestions.queryOptions({ appId, country, seed: seed || undefined }),
    enabled: open,
    staleTime: 10 * 60 * 1000,
  });

  const add = useMutation(
    trpc.keywords.add.mutationOptions({
      onSuccess: async ({ added, failed }) => {
        await queryClient.invalidateQueries(trpc.keywords.pathFilter());
        await queryClient.invalidateQueries(trpc.apps.tracked.pathFilter());
        if (failed.length) toast.warning(`Added ${added}; failed: ${failed.join(", ")}`);
        else toast.success(`Added ${added} keyword${added === 1 ? "" : "s"}`);
        onOpenChange(false);
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const list = suggestions.data ?? [];
  const toggle = (term: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(term)) next.delete(term);
      else next.add(term);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !add.isPending && onOpenChange(o)}>
      <DialogContent className="gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LightbulbIcon className="size-5 text-orange-400" /> Keyword suggestions
          </DialogTitle>
          <DialogDescription>
            Ideas for {appName} in {countryFlag(country)} {country}, from its metadata, App Store autocomplete and
            competitors’ titles. Popularity is estimated from autocomplete.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSeed(seedInput.trim() || undefined);
            setSelected(new Set());
          }}
        >
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Optional seed keyword, e.g. “budget planner”"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton type="submit" variant="secondary" size="xs">
                Suggest
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={list.length > 0 && selected.size === list.length ? true : selected.size > 0 ? "indeterminate" : false}
              disabled={list.length === 0}
              onCheckedChange={(v) => setSelected(v ? new Set(list.map((s) => s.term)) : new Set())}
            />
            <span className="text-muted-foreground">
              {selected.size > 0 ? `${selected.size} selected` : `${list.length} suggestions`}
            </span>
          </label>
          <Button
            variant="ghost"
            size="sm"
            disabled={suggestions.isFetching}
            onClick={() => void suggestions.refetch()}
          >
            <RefreshCwIcon className={cn(suggestions.isFetching && "animate-spin")} /> Regenerate
          </Button>
        </div>

        <div className="-mx-2 h-[400px] overflow-y-auto">
          <div className="px-2">
            {suggestions.isLoading && (
              <div className="space-y-1">
                <p className="text-muted-foreground flex items-center gap-2 p-2 text-sm">
                  <Spinner /> Analysing autocomplete and competitors — this can take a few seconds…
                </p>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <Skeleton className="size-4" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
            )}
            {suggestions.isError && <p className="text-destructive p-4 text-sm">{suggestions.error.message}</p>}
            {!suggestions.isLoading && list.length === 0 && !suggestions.isError && (
              <p className="text-muted-foreground p-8 text-center text-sm">
                No suggestions yet. Add a few keywords or try a seed keyword.
              </p>
            )}
            {list.map((s) => (
              <label
                key={s.term}
                className="hover:bg-muted/60 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2"
              >
                <Checkbox checked={selected.has(s.term)} onCheckedChange={() => toggle(s.term)} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.term}</span>
                <span className="hidden gap-1 sm:flex">
                  {s.sources.slice(0, 2).map((src) => (
                    <Badge key={src} variant="outline" className="text-muted-foreground text-[10px]">
                      {SOURCE_LABEL[src] ?? src}
                    </Badge>
                  ))}
                </span>
                <ScoreBar value={s.popularity} className="w-36 shrink-0" />
              </label>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={selected.size === 0 || add.isPending}
            className="bg-orange-500 text-white hover:bg-orange-400"
            onClick={() => add.mutate({ appId, country, terms: [...selected] })}
          >
            {add.isPending ? <Spinner /> : <PlusIcon />}
            {add.isPending ? "Fetching keyword data…" : `Add ${selected.size || ""} keywords`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
