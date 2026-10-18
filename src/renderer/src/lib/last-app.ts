import { redirect } from "@tanstack/react-router";
import { queryClient } from "@/trpc/query-client";
import { trpc } from "@/trpc/react";

/** The app open when the window last closed; cleared on any other page. */
const STORAGE_KEY = "openaso:last-app-id";

function read() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Taken once at startup, so writes from the first render can't clobber it. */
const launchAppId = read();
let restored = false;

export function rememberLastApp(appId: string | undefined) {
  try {
    if (appId) localStorage.setItem(STORAGE_KEY, appId);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be blocked; nothing else to do.
  }
}

/** On the first load of Home, reopens the last app if it's still tracked. */
export async function restoreLastApp(pathname: string) {
  if (restored) return;
  restored = true;
  if (pathname !== "/" || !launchAppId) return;
  try {
    const tracked = await queryClient.ensureQueryData(trpc.apps.tracked.queryOptions());
    if (!tracked.some((app) => app.id === launchAppId)) return rememberLastApp(undefined);
  } catch {
    return;
  }
  throw redirect({ to: "/apps/$appId", params: { appId: launchAppId }, replace: true });
}
