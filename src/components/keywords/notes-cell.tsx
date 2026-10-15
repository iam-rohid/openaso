"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

/** Click-to-edit note; saves on blur or Enter, Escape cancels. */
export function NotesCell({
  appId,
  keywordId,
  notes,
}: {
  appId: string;
  keywordId: number;
  notes: string | null;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(notes ?? "");

  const save = useMutation(
    trpc.keywords.updateNotes.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(trpc.keywords.list.pathFilter()),
      onError: (err) => toast.error(err.message),
    }),
  );

  const commit = () => {
    setEditing(false);
    if (value.trim() !== (notes ?? "")) save.mutate({ appId, keywordId, notes: value });
  };

  if (editing) {
    return (
      <Input
        autoFocus
        value={value}
        maxLength={500}
        className="h-7 text-sm"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setValue(notes ?? "");
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      title={notes ?? "Add a note"}
      className="text-muted-foreground hover:text-foreground block h-7 w-full truncate rounded px-1 text-left"
      onClick={() => {
        setValue(notes ?? "");
        setEditing(true);
      }}
    >
      {save.isPending ? value : notes || <span className="opacity-0 group-hover/row:opacity-60">Add note…</span>}
    </button>
  );
}
