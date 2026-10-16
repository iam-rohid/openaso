import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, LinkIcon, PlusIcon, SearchIcon, StarIcon } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { TemporaryAppForm } from "@/components/apps/temporary-app-form";
import { AppIcon } from "@/components/shared/app-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useCountry } from "@/hooks/use-country";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { countryFlag } from "@shared/countries";
import { compactNumber } from "@/lib/format";
import { useTRPC } from "@/trpc/react";

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
  linkFrom?: { id: string; name: string };
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [country] = useCountry();
  const [query, setQuery] = useState("");
  const [step, setStep] = useState<"search" | "temporary">("search");
  const debounced = useDebouncedValue(query.trim(), 350);

  const tracked = useQuery(trpc.apps.tracked.queryOptions({ country }));
  const trackedIds = new Set(tracked.data?.map((a) => a.id));
  const search = useQuery({
    ...trpc.apps.search.queryOptions({ query: debounced, country }),
    enabled: debounced.length > 1,
    staleTime: 5 * 60 * 1000,
  });

  const setOpen = (next: boolean) => {
    onOpenChange(next);
    if (!next) setStep("search");
  };
  const onAdded = async (app: { id: string; name: string }, message: string) => {
    toast.success(message);
    setOpen(false);
    setQuery("");
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

  if (step === "temporary") {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <TemporaryAppForm
            title="Add Temporary App"
            description="Research keywords for an app that isn’t on the App Store yet. Link it to the real listing once it launches."
            initialName={query.trim()}
            submitLabel="Create"
            cancelLabel="Back"
            isPending={createTemporary.isPending}
            onSubmit={(name) => createTemporary.mutate({ name, country, folderId })}
            onCancel={() => setStep("search")}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-3 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{linkFrom ? `Link “${linkFrom.name}”` : "Add app"}</DialogTitle>
          <DialogDescription>
            {linkFrom
              ? "Its keywords and notes move to the App Store app you pick, and the temporary app is removed. "
              : ""}
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
          {!linkFrom && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton variant="secondary" onClick={() => setStep("temporary")}>
                Add Temporary App
              </InputGroupButton>
            </InputGroupAddon>
          )}
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
              <div className="text-muted-foreground flex flex-col items-center gap-3 p-8 text-center text-sm">
                <p>No apps found.</p>
                {!linkFrom && (
                  <Button size="sm" variant="secondary" onClick={() => setStep("temporary")}>
                    <PlusIcon /> Add “{debounced.slice(0, 30)}” as a temporary app
                  </Button>
                )}
              </div>
            )}
            {debounced.length <= 1 && (
              <p className="text-muted-foreground p-8 text-center text-sm">Start typing to search.</p>
            )}
            {search.data?.map((app) => {
              const isTracked = trackedIds.has(app.id);
              const isRowPending = pendingId === app.id;
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
                  {linkFrom ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={isPending}
                      onClick={() => link.mutate({ id: linkFrom.id, targetId: app.id, country })}
                    >
                      {isRowPending ? <Spinner /> : <LinkIcon />} {isTracked ? "Merge into" : "Link"}
                    </Button>
                  ) : isTracked ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setOpen(false);
                        void navigate({ to: "/apps/$appId", params: { appId: app.id } });
                      }}
                    >
                      <CheckIcon /> Added
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={isPending}
                      onClick={() => track.mutate({ id: app.id, country, folderId })}
                    >
                      {isRowPending ? <Spinner /> : <PlusIcon />} Add
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
