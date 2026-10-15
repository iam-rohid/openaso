"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCountry, withCountry } from "@/hooks/use-country";
import { useTRPC } from "@/trpc/react";

/** Deletes a folder (its apps move to the top level) and leaves its page if it's open. */
export function useDeleteFolder() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const [country] = useCountry();

  return useMutation(
    trpc.folders.delete.mutationOptions({
      onSuccess: async ({ movedCount }, { id }) => {
        if (pathname === `/folders/${id}`) router.push(withCountry("/", country));
        // Leave the deleted folder's own `get` query alone: refetching it would just 404.
        await Promise.all([
          queryClient.invalidateQueries(trpc.folders.list.pathFilter()),
          queryClient.invalidateQueries(trpc.apps.tracked.pathFilter()),
        ]);
        toast.success(
          movedCount > 0
            ? `Folder deleted — ${movedCount} app${movedCount === 1 ? "" : "s"} moved out`
            : "Folder deleted",
        );
      },
      onError: (err) => toast.error(err.message),
    }),
  );
}
