import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Command as CommandPrimitive } from "cmdk";
import { CheckIcon, CornerDownLeftIcon, LinkIcon, PlusIcon, SearchIcon, StarIcon } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppIcon } from "@/components/shared/app-icon";
import { CountrySelect } from "@/components/shared/country-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { parseCountry, useStoredCountry } from "@/hooks/use-country";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { compactNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/react";
import { TEMPORARY_APP_NAME_MAX } from "@shared/apps";
import type { CountryCode } from "@shared/countries";

type SearchResult = { id: string; name: string };

/**
 * Spotlight-style box for adding an app: search the App Store (or paste a link), pick a
 * storefront, or create a temporary app. With `linkFrom` it instead picks the listing a
 * temporary app becomes.
 */
export function AddAppDialog({
  open,
  onOpenChange,
  folderId,
  linkFrom,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Newly tracked apps go straight into this folder. */
  folderId?: number;
  /** Pick the App Store listing this temporary app becomes, instead of adding an app. */
  linkFrom?: { id: string; name: string; country: string };
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Adding remembers the last storefront; linking starts from the temporary app's.
  const [savedCountry, setSavedCountry] = useStoredCountry("openaso:add-country");
  const [linkCountry, setLinkCountry] = useState<CountryCode | null>(null);
  const country = linkFrom ? (linkCountry ?? parseCountry(linkFrom.country) ?? savedCountry) : savedCountry;
  const setCountry = linkFrom ? setLinkCountry : setSavedCountry;

  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), 350);

  const tracked = useQuery(trpc.apps.tracked.queryOptions());
  const trackedIds = new Set(tracked.data?.map((a) => a.id));
  const search = useQuery({
    ...trpc.apps.search.queryOptions({ query: debounced, country }),
    enabled: debounced.length > 1,
    staleTime: 5 * 60 * 1000,
  });

  const setOpen = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setQuery("");
      setLinkCountry(null);
    }
  };
  const onAdded = async (app: SearchResult, message: string) => {
    toast.success(message);
    setOpen(false);
    // Navigate before invalidating so a just-linked temporary app's page doesn't refetch
    // itself; it's gone, so it's also kept out of history.
    await navigate({ to: "/apps/$appId", params: { appId: app.id }, replace: !!linkFrom });
    await Promise.all([
      queryClient.invalidateQueries(trpc.apps.pathFilter()),
      queryClient.invalidateQueries(trpc.folders.pathFilter()),
      queryClient.invalidateQueries(trpc.keywords.pathFilter()),
    ]);
  };
  const onError = (err: { message: string }) => toast.error(err.message);

  const track = useMutation(
    trpc.apps.track.mutationOptions({ onSuccess: (app) => onAdded(app, `${app.name} added`), onError }),
  );
  const createTemporary = useMutation(
    trpc.apps.createTemporary.mutationOptions({ onSuccess: (app) => onAdded(app, `${app.name} added`), onError }),
  );
  const link = useMutation(
    trpc.apps.linkTemporary.mutationOptions({
      onSuccess: ({ app, moved }) =>
        onAdded(app, `Linked: moved ${moved} keyword${moved === 1 ? "" : "s"} to ${app.name}`),
      onError,
    }),
  );
  const isPending = track.isPending || link.isPending;
  const pendingId = track.isPending ? track.variables?.id : link.isPending ? link.variables?.targetId : undefined;

  /** What Enter or a click does to a result. */
  const choose = (app: SearchResult) => {
    if (isPending) return;
    if (linkFrom) link.mutate({ id: linkFrom.id, targetId: app.id, country });
    else if (trackedIds.has(app.id)) {
      setOpen(false);
      void navigate({ to: "/apps/$appId", params: { appId: app.id } });
    } else track.mutate({ id: app.id, country, folderId });
  };

  const showResults = debounced.length > 1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "top-[14vh] translate-y-0 gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl sm:max-w-2xl",
          "data-open:slide-in-from-top-2",
        )}
        // Esc clears the query first, like Spotlight; a second Esc closes.
        onEscapeKeyDown={(e) => {
          if (query) {
            e.preventDefault();
            setQuery("");
          }
        }}
      >
        <DialogTitle className="sr-only">{linkFrom ? `Link “${linkFrom.name}”` : "Add app"}</DialogTitle>
        <DialogDescription className="sr-only">
          Search the App Store by app or developer name, or paste an App Store link.
        </DialogDescription>

        {/* min-w-0: as the dialog's grid item it would otherwise widen to fit untruncated names. */}
        <CommandPrimitive shouldFilter={false} loop className="flex min-w-0 flex-col">
          <div className="flex h-16 items-center gap-3 pr-3 pl-5">
            {search.isFetching ? (
              <Spinner className="text-muted-foreground size-5" />
            ) : (
              <SearchIcon className="text-muted-foreground size-5 shrink-0" />
            )}
            <CommandPrimitive.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder={
                linkFrom
                  ? `Find the App Store listing for “${linkFrom.name}”…`
                  : "App name, developer or App Store URL"
              }
              className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-lg outline-none"
            />
            {!linkFrom && (
              <Button
                size="sm"
                variant="secondary"
                className="shrink-0"
                disabled={createTemporary.isPending}
                onClick={() => createTemporary.mutate({ country, folderId })}
              >
                {createTemporary.isPending && <Spinner />} Add Temporary App
              </Button>
            )}
            <CountrySelect value={country} onChange={setCountry} variant="ghost" className="min-w-0 shrink-0" />
          </div>

          {showResults && (
            <CommandPrimitive.List className="max-h-[min(440px,60vh)] scroll-py-2 overflow-y-auto border-t p-2">
              {search.isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2">
                    <Skeleton className="size-11 rounded-xl" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              {search.isError && <p className="text-destructive p-4 text-sm">{search.error.message}</p>}
              {search.data?.length === 0 && (
                <div className="text-muted-foreground flex flex-col items-center gap-3 p-8 text-center text-sm">
                  <p>No apps found.</p>
                  {!linkFrom && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={createTemporary.isPending}
                      onClick={() => createTemporary.mutate({ name: debounced.slice(0, TEMPORARY_APP_NAME_MAX), country, folderId })}
                    >
                      <PlusIcon /> Add “{debounced.slice(0, TEMPORARY_APP_NAME_MAX)}” as a temporary app
                    </Button>
                  )}
                </div>
              )}
              {search.data?.map((app) => {
                const isTracked = trackedIds.has(app.id);
                const isRowPending = pendingId === app.id;
                return (
                  <CommandPrimitive.Item
                    key={app.id}
                    value={app.id}
                    onSelect={() => choose(app)}
                    className="group data-[selected=true]:bg-muted flex cursor-default items-center gap-3 rounded-lg px-3 py-2 outline-none"
                  >
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
                    {/* The whole row is the action; this just labels it. */}
                    <span
                      className={cn(
                        "text-muted-foreground group-data-[selected=true]:text-foreground flex shrink-0 items-center gap-1.5 text-xs font-medium",
                      )}
                    >
                      {isRowPending ? (
                        <Spinner />
                      ) : linkFrom ? (
                        <LinkIcon className="size-3.5" />
                      ) : isTracked ? (
                        <CheckIcon className="size-3.5" />
                      ) : (
                        <PlusIcon className="size-3.5" />
                      )}
                      {linkFrom ? (isTracked ? "Merge into" : "Link") : isTracked ? "Open" : "Add"}
                      <CornerDownLeftIcon className="hidden size-3.5 opacity-60 group-data-[selected=true]:block" />
                    </span>
                  </CommandPrimitive.Item>
                );
              })}
            </CommandPrimitive.List>
          )}
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
}
