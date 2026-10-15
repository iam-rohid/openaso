import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  DEFAULT_FOLDER_COLOR,
  FOLDER_COLORS,
  FOLDER_NAME_MAX,
  type FolderColor,
  folderColorClasses,
} from "@shared/folders";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/react";

export type FolderDialogTarget = {
  /** Folder to edit; omit to create a new one. */
  folder?: { id: number; name: string; color: FolderColor };
  /** When creating, move this tracked app into the new folder. */
  appId?: string;
};

/** Create or edit a folder: a name plus one of the preset colors. */
export function FolderDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: FolderDialogTarget;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {/* Content unmounts when closed, so the form state resets on every open. */}
        <FolderForm target={target} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function FolderForm({ target, onDone }: { target: FolderDialogTarget; onDone: () => void }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [name, setName] = useState(target.folder?.name ?? "");
  const [color, setColor] = useState<FolderColor>(target.folder?.color ?? DEFAULT_FOLDER_COLOR);
  const isEdit = !!target.folder;

  const onSuccess = async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.folders.pathFilter()),
      queryClient.invalidateQueries(trpc.apps.tracked.pathFilter()),
    ]);
    onDone();
  };
  const onError = (err: { message: string }) => toast.error(err.message);
  const create = useMutation(trpc.folders.create.mutationOptions({ onSuccess, onError }));
  const update = useMutation(trpc.folders.update.mutationOptions({ onSuccess, onError }));
  const isPending = create.isPending || update.isPending;
  const trimmed = name.trim();

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!trimmed || isPending) return;
        if (target.folder) update.mutate({ id: target.folder.id, name: trimmed, color });
        else create.mutate({ name: trimmed, color, appId: target.appId });
      }}
    >
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit Folder" : "New Folder"}</DialogTitle>
        <DialogDescription className="sr-only">Choose a name and color for the folder.</DialogDescription>
      </DialogHeader>
      <Input
        autoFocus
        placeholder="Folder name"
        maxLength={FOLDER_NAME_MAX}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div role="radiogroup" aria-label="Folder color" className="flex justify-center gap-3">
        {FOLDER_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={c}
            onClick={() => setColor(c)}
            className={cn(
              "ring-offset-background size-7 rounded-full transition-transform outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              folderColorClasses[c].swatch,
              color === c && "ring-foreground/70 scale-110 ring-2 ring-offset-2",
            )}
          />
        ))}
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!trimmed || isPending}>
          {isPending && <Spinner />} {isEdit ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}
