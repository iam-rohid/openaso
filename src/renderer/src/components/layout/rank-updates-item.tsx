import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChartLineIcon, PauseIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useTRPC } from "@/trpc/react";

/** Keyword tables refetch at most this often while a run is in progress. */
const LIVE_REFRESH_MS = 10_000;

/** Sidebar footer row for the daily ranking update's progress; its switch is in Settings. */
export function RankUpdatesItem({ onOpenSettings }: { onOpenSettings: () => void }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const status = useQuery({
    ...trpc.rankUpdates.status.queryOptions(),
    refetchInterval: (query) => (query.state.data?.running ? 2_000 : 30_000),
  });

  // Show new positions as they land (throttled), and once more when the run ends.
  const data = status.data;
  const lastRefresh = useRef({ done: 0, at: 0, running: false });
  useEffect(() => {
    if (!data) return;
    const prev = lastRefresh.current;
    const finished = prev.running && !data.running;
    const progressed = data.running && data.done !== prev.done && Date.now() - prev.at > LIVE_REFRESH_MS;
    if (finished || progressed) {
      void queryClient.invalidateQueries(trpc.keywords.list.pathFilter());
      lastRefresh.current = { done: data.done, at: Date.now(), running: data.running };
    } else {
      lastRefresh.current = { ...prev, running: data.running };
    }
  }, [data, queryClient, trpc]);

  if (!data) return null;

  let icon = <ChartLineIcon />;
  let label = "Rankings up to date";
  let detail: string | null = data.lastCompletedAt ? `Updated ${format(data.lastCompletedAt, "p")}` : null;
  if (!data.enabled) {
    label = "Daily updates off";
    detail = null;
  } else if (data.pausedUntil) {
    icon = <PauseIcon />;
    label = "Ranking update paused";
    detail = `Apple is rate limiting · resumes ${format(data.pausedUntil, "p")}`;
  } else if (data.running && data.total > 0) {
    icon = <RefreshCwIcon className="animate-spin" />;
    label = "Updating rankings";
    detail = `${data.done} of ${data.total} keywords`;
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton size={detail ? "lg" : "default"} className="text-muted-foreground" onClick={onOpenSettings}>
        {icon}
        <div className="grid flex-1 text-left leading-tight">
          <span className="truncate">{label}</span>
          {detail && <span className="truncate text-xs opacity-80">{detail}</span>}
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
