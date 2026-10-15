"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, PlusIcon, SearchIcon, StarIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AppIcon } from "@/components/shared/app-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useCountry, withCountry } from "@/hooks/use-country";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { countryFlag } from "@/lib/countries";
import { compactNumber } from "@/lib/format";
import { useTRPC } from "@/trpc/react";

export function AddAppDialog({
  open,
  onOpenChange,
  folderId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Newly tracked apps go straight into this folder. */
  folderId?: number;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [country] = useCountry();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), 350);

  const tracked = useQuery(trpc.apps.tracked.queryOptions({ country }));
  const trackedIds = new Set(tracked.data?.map((a) => a.id));
  const search = useQuery({
    ...trpc.apps.search.queryOptions({ query: debounced, country }),
    enabled: debounced.length > 1,
    staleTime: 5 * 60 * 1000,
  });

  const track = useMutation(
    trpc.apps.track.mutationOptions({
      onSuccess: async (app) => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.apps.tracked.pathFilter()),
          queryClient.invalidateQueries(trpc.folders.pathFilter()),
        ]);
        toast.success(`${app.name} added`);
        onOpenChange(false);
        setQuery("");
        router.push(withCountry(`/apps/${app.id}`, country));
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add app</DialogTitle>
          <DialogDescription>
            Search the {countryFlag(country)} {country} App Store by name, or paste an App Store link or id.
          </DialogDescription>
        </DialogHeader>
        <InputGroup>
          <InputGroupAddon>
            {search.isFetching ? <Spinner /> : <SearchIcon />}
          </InputGroupAddon>
          <InputGroupInput
            autoFocus
            placeholder="e.g. Duolingo or https://apps.apple.com/…/id570060128"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </InputGroup>

        <div className="-mx-2 h-[420px] overflow-y-auto">
          <div className="space-y-0.5 px-2">
            {search.isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="size-11 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            {search.isError && <p className="text-destructive p-4 text-sm">{search.error.message}</p>}
            {search.data?.length === 0 && (
              <p className="text-muted-foreground p-8 text-center text-sm">No apps found.</p>
            )}
            {debounced.length <= 1 && (
              <p className="text-muted-foreground p-8 text-center text-sm">Start typing to search.</p>
            )}
            {search.data?.map((app) => {
              const isTracked = trackedIds.has(app.id);
              const isPending = track.isPending && track.variables?.id === app.id;
              return (
                <div key={app.id} className="hover:bg-muted/60 flex items-center gap-3 rounded-lg p-2">
                  <AppIcon src={app.iconUrl} name={app.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{app.name}</p>
                    <p className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
                      <span className="truncate">{app.developer}</span>
                      {app.rating != null && !!app.ratingCount && (
                        <>
                          <span>·</span>
                          <StarIcon className="size-3 fill-current" />
                          {app.rating.toFixed(1)} ({compactNumber(app.ratingCount)})
                        </>
                      )}
                      {app.genre && <span className="hidden sm:inline">· {app.genre}</span>}
                    </p>
                  </div>
                  {isTracked ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        onOpenChange(false);
                        router.push(withCountry(`/apps/${app.id}`, country));
                      }}
                    >
                      <CheckIcon /> Added
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={track.isPending}
                      onClick={() => track.mutate({ id: app.id, country, folderId })}
                    >
                      {isPending ? <Spinner /> : <PlusIcon />} Add
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
