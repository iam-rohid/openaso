"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { countryFlag, type CountryCode } from "@/lib/countries";
import { useTRPC } from "@/trpc/react";

function parseTerms(text: string) {
  return [
    ...new Set(
      text
        .split(/[,\n]/)
        .map((t) => t.trim().toLowerCase().replace(/\s+/g, " "))
        .filter((t) => t.length > 0 && t.length <= 100),
    ),
  ];
}

export function AddKeywordsDialog({
  appId,
  country,
  open,
  onOpenChange,
  existingTerms,
}: {
  appId: string;
  country: CountryCode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTerms: Set<string>;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const terms = useMemo(() => parseTerms(text), [text]);
  const newTerms = terms.filter((t) => !existingTerms.has(t));

  // Autocomplete the fragment currently being typed.
  const fragment = useDebouncedValue(text.split(/[,\n]/).at(-1)?.trim() ?? "", 250);
  const hints = useQuery({
    ...trpc.keywords.hints.queryOptions({ term: fragment, country }),
    enabled: open && fragment.length > 1,
    staleTime: 10 * 60 * 1000,
  });

  const add = useMutation(
    trpc.keywords.add.mutationOptions({
      onSuccess: async ({ added, failed }) => {
        await queryClient.invalidateQueries(trpc.keywords.pathFilter());
        await queryClient.invalidateQueries(trpc.apps.tracked.pathFilter());
        if (failed.length) toast.warning(`Added ${added}; failed: ${failed.join(", ")}`);
        else toast.success(`Added ${added} keyword${added === 1 ? "" : "s"}`);
        setText("");
        onOpenChange(false);
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const appendHint = (hint: string) => {
    const parts = text.split(/([,\n])/);
    parts[parts.length - 1] = parts.length > 1 ? ` ${hint}` : hint;
    setText(`${parts.join("")}, `);
  };

  const submit = () => {
    if (newTerms.length > 0) add.mutate({ appId, country, terms: newTerms });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !add.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add keywords</DialogTitle>
          <DialogDescription>
            Separate keywords with commas or new lines. Data is fetched from the {countryFlag(country)} {country}{" "}
            App Store (or reused from the local cache).
          </DialogDescription>
        </DialogHeader>

        <Textarea
          autoFocus
          rows={5}
          value={text}
          disabled={add.isPending}
          placeholder={"habit tracker, daily planner\nroutine app"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />

        {fragment.length > 1 && (hints.data?.length ?? 0) > 0 && (
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs">App Store autocomplete for “{fragment}”</p>
            <div className="flex flex-wrap gap-1.5">
              {hints.data!.slice(0, 10).map((hint) => (
                <Button
                  key={hint}
                  size="xs"
                  variant="secondary"
                  disabled={terms.includes(hint)}
                  onClick={() => appendHint(hint)}
                >
                  <PlusIcon /> {hint}
                </Button>
              ))}
            </div>
          </div>
        )}

        {terms.length > 0 && (
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
            {terms.map((t) => (
              <Badge key={t} variant={existingTerms.has(t) ? "outline" : "secondary"} className="gap-1">
                {t}
                {existingTerms.has(t) && <span className="text-muted-foreground">(tracked)</span>}
                <button
                  type="button"
                  aria-label={`Remove ${t}`}
                  onClick={() => setText(terms.filter((x) => x !== t).join(", "))}
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-muted-foreground hidden text-xs sm:block">
            <Kbd>⌘</Kbd> <Kbd>Enter</Kbd> to add
          </p>
          <Button
            onClick={submit}
            disabled={newTerms.length === 0 || add.isPending}
            className="bg-indigo-600 text-white hover:bg-indigo-500"
          >
            {add.isPending ? <Spinner /> : <PlusIcon />}
            {add.isPending
              ? `Fetching ${newTerms.length} keyword${newTerms.length === 1 ? "" : "s"}…`
              : `Add ${newTerms.length || ""} keyword${newTerms.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
