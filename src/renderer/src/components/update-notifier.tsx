import { useEffect } from "react";
import { toast } from "sonner";

/** Shows a toast when the main process finds a newer version of the app. */
export function UpdateNotifier() {
  useEffect(
    () =>
      window.openaso.onUpdate((update) => {
        if (update.kind === "ready") {
          toast.info(`OpenASO ${update.version} is ready to install`, {
            id: "update",
            duration: Infinity,
            action: { label: "Restart", onClick: () => window.openaso.installUpdate() },
          });
        } else {
          toast.info(`OpenASO ${update.version} is available`, {
            id: "update",
            duration: Infinity,
            action: { label: "Download", onClick: () => window.open(update.url) },
          });
        }
      }),
    [],
  );
  return null;
}
