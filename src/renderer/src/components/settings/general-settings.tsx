import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTRPC } from "@/trpc/react";
import { SEGMENT_ITEM, SettingsRow, SettingsSection } from "./settings-row";

const THEMES = [
  { value: "system", label: "System", icon: MonitorIcon },
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
] as const;

export function GeneralSettings() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const about = useQuery(trpc.settings.about.queryOptions());
  const rankUpdates = useQuery(trpc.rankUpdates.status.queryOptions());
  const setRankUpdates = useMutation(
    trpc.rankUpdates.setEnabled.mutationOptions({
      onSuccess: (next) => queryClient.setQueryData(trpc.rankUpdates.status.queryKey(), next),
      onError: (err) => toast.error(err.message),
    }),
  );
  const openDataFolder = useMutation(trpc.settings.openDataFolder.mutationOptions());
  const checkForUpdates = useMutation(trpc.settings.checkForUpdates.mutationOptions());

  return (
    <>
      <SettingsSection title="Appearance">
        <SettingsRow
          label="Theme"
          control={
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={0}
              value={theme}
              onValueChange={(value) => value && setTheme(value as (typeof THEMES)[number]["value"])}
            >
              {THEMES.map(({ value, label, icon: Icon }) => (
                <Tooltip key={value}>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem value={value} aria-label={label} className={SEGMENT_ITEM}>
                      <Icon />
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>{label}</TooltipContent>
                </Tooltip>
              ))}
            </ToggleGroup>
          }
        />
      </SettingsSection>

      <SettingsSection title="Rankings">
        <SettingsRow
          label="Update rankings daily"
          htmlFor="settings-rank-updates"
          description="Refresh every tracked keyword once a day while OpenASO is open, so each one gets a daily point for its trend."
          control={
            <Switch
              id="settings-rank-updates"
              checked={rankUpdates.data?.enabled ?? false}
              disabled={!rankUpdates.data}
              onCheckedChange={(enabled) => setRankUpdates.mutate({ enabled })}
            />
          }
        />
      </SettingsSection>

      <SettingsSection title="About">
        <SettingsRow
          label="Data folder"
          description={<span className="block truncate font-mono text-xs">{about.data?.dataFolder}</span>}
          control={
            <Button variant="outline" size="sm" onClick={() => openDataFolder.mutate()}>
              Open
            </Button>
          }
        />
        <SettingsRow
          label="Version"
          description={about.data ? `OpenASO ${about.data.version}` : null}
          control={
            <Button
              variant="outline"
              size="sm"
              disabled={checkForUpdates.isPending}
              onClick={() => checkForUpdates.mutate()}
            >
              Check for Updates
            </Button>
          }
        />
      </SettingsSection>
    </>
  );
}
