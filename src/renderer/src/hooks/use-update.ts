import { useSyncExternalStore } from "react";
import type { UpdateStatus } from "@shared/ipc";

let current: UpdateStatus | null = null;
const listeners = new Set<() => void>();

function set(next: UpdateStatus | null) {
  current = next;
  for (const listener of listeners) listener();
}

// One subscription for the whole window. Asking as well as listening covers an update found
// before the page loaded (or before a reload).
window.openaso.onUpdate(set);
void window.openaso.getUpdate().then((status) => {
  if (status && !current) set(status);
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The newer version found by the main process, or null while the app is up to date. */
export function useUpdate() {
  return useSyncExternalStore(subscribe, () => current);
}
