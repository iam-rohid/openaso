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
import { TEMPORARY_APP_NAME_MAX } from "@shared/apps";
import { useTRPC } from "@/trpc/react";

/** Name form for renaming a temporary app. */
export function TemporaryAppForm({
  title,
  description,
  initialName,
  submitLabel,
  isPending,
  onSubmit,
  onCancel,
}: {
  title: string;
  description: string;
  initialName: string;
  submitLabel: string;
  isPending: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName.slice(0, TEMPORARY_APP_NAME_MAX));
  const trimmed = name.trim();

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed && !isPending) onSubmit(trimmed);
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <Input
        autoFocus
        placeholder="App name"
        maxLength={TEMPORARY_APP_NAME_MAX}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!trimmed || isPending}>
          {isPending && <Spinner />} {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function RenameTemporaryAppDialog({
  app,
  open,
  onOpenChange,
}: {
  app: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const rename = useMutation(
    trpc.apps.renameTemporary.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.apps.pathFilter()),
          queryClient.invalidateQueries(trpc.folders.pathFilter()),
        ]);
        onOpenChange(false);
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {/* Content unmounts when closed, so the name resets on every open. */}
        <TemporaryAppForm
          title="Rename App"
          description="Temporary apps keep this name until you link them to the App Store."
          initialName={app.name}
          submitLabel="Save"
          isPending={rename.isPending}
          onSubmit={(name) => rename.mutate({ id: app.id, name })}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
