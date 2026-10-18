import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DEFAULT_MCP_PORT, MCP_GUIDE_URL, type McpSettings, type McpStatus } from "@shared/mcp";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/react";
import { CopyButton } from "./copy-button";
import { SEGMENT_ITEM, SettingsRow, SettingsSection } from "./settings-row";

type Client = { id: string; label: string; snippet: (status: McpStatus) => string; hint: React.ReactNode };

const json = (value: unknown) => JSON.stringify(value, null, 2);

const CLIENTS: Client[] = [
  {
    id: "claude-desktop",
    label: "Claude Desktop",
    snippet: (status) => json({ mcpServers: { openaso: status.claudeDesktop.server } }),
    hint: (
      <>
        Add <code>openaso</code> to the <code>mcpServers</code> in Claude Desktop&apos;s{" "}
        <ShowClaudeConfig />, then restart Claude. No other install needed.
      </>
    ),
  },
  {
    id: "claude-code",
    label: "Claude Code",
    snippet: ({ url }) => `claude mcp add --transport http openaso ${url}`,
    hint: "Run this in a terminal, then start a new Claude Code session.",
  },
  {
    id: "cursor",
    label: "Cursor",
    snippet: ({ url }) => json({ mcpServers: { openaso: { url } } }),
    hint: (
      <>
        Add this to <code>~/.cursor/mcp.json</code>, then restart Cursor.
      </>
    ),
  },
  {
    id: "vscode",
    label: "VS Code",
    snippet: ({ url }) => json({ servers: { openaso: { type: "http", url } } }),
    hint: (
      <>
        Add this to <code>.vscode/mcp.json</code>, or run <strong>MCP: Add Server</strong> from the Command Palette.
      </>
    ),
  },
  {
    id: "other",
    label: "Other",
    snippet: ({ url }) => url,
    hint: "Any MCP client that supports Streamable HTTP can connect to this URL.",
  },
];

export function McpSettings() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const status = useQuery({ ...trpc.settings.mcpStatus.queryOptions(), refetchInterval: 5_000 });
  const update = useMutation(
    trpc.settings.updateMcp.mutationOptions({
      onSuccess: (next) => queryClient.setQueryData(trpc.settings.mcpStatus.queryKey(), next),
      onError: (err) => toast.error(err.message),
    }),
  );
  const change = (patch: Partial<McpSettings>) => update.mutate(patch);

  const data = status.data;
  const [client, setClient] = useState(CLIENTS[0].id);
  const selected = CLIENTS.find((c) => c.id === client) ?? CLIENTS[0];
  const enabled = data?.enabled ?? false;

  return (
    <SettingsSection title="MCP Server">
      <SettingsRow
        label="Enable MCP server"
        htmlFor="settings-mcp-enabled"
        description="Let AI agents like Claude research keywords and manage your tracked apps while OpenASO is open."
        control={
          <Switch
            id="settings-mcp-enabled"
            checked={enabled}
            disabled={!data || update.isPending}
            onCheckedChange={(next) => change({ enabled: next })}
          />
        }
      >
        {data && <ServerState status={data} />}
      </SettingsRow>

      <div className={cn("divide-y transition-opacity", !enabled && "opacity-60")}>
        <SettingsRow
          label="Start with OpenASO"
          htmlFor="settings-mcp-auto-start"
          description="Turn the server on whenever OpenASO opens."
          control={
            <Checkbox
              id="settings-mcp-auto-start"
              checked={data?.autoStart ?? false}
              disabled={!data}
              onCheckedChange={(next) => change({ autoStart: next === true })}
            />
          }
        />
        <SettingsRow
          label="Port"
          htmlFor="settings-mcp-port"
          description="Change it if another app uses this port."
          control={data && <PortInput key={data.port} port={data.port} onChange={(port) => change({ port })} />}
        />
        <SettingsRow
          label="Allow agents to remove data"
          htmlFor="settings-mcp-remove"
          description="Lets agents untrack apps and remove keywords. Reconnect your agent after changing this."
          control={
            <Switch
              id="settings-mcp-remove"
              checked={data?.allowRemove ?? false}
              disabled={!data}
              onCheckedChange={(next) => change({ allowRemove: next })}
            />
          }
        />
        <SettingsRow label="Connect an agent">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={client}
            onValueChange={(value) => value && setClient(value)}
            className="mt-3"
          >
            {CLIENTS.map((c) => (
              <ToggleGroupItem key={c.id} value={c.id} className={SEGMENT_ITEM}>
                {c.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {data && (
            <div className="relative mt-3 rounded-lg border bg-muted/40">
              <pre className="overflow-x-auto p-3 pr-24 font-mono text-xs leading-relaxed">
                {selected.snippet(data)}
              </pre>
              <div className="absolute top-2 right-2">
                <CopyButton text={selected.snippet(data)} />
              </div>
            </div>
          )}
          <p className="mt-2 text-sm text-muted-foreground [&_code]:font-mono [&_code]:text-xs">
            {selected.hint}{" "}
            <a
              href={MCP_GUIDE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
            >
              Setup guide
              <ExternalLinkIcon className="size-3" />
            </a>
          </p>
        </SettingsRow>
      </div>
    </SettingsSection>
  );
}

function ServerState({ status }: { status: McpStatus }) {
  if (status.error) {
    return (
      <p className="mt-3 flex items-center gap-2 text-sm text-destructive">
        <span className="size-2 shrink-0 rounded-full bg-destructive" />
        {status.error}
      </p>
    );
  }
  if (!status.running) {
    return (
      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="size-2 shrink-0 rounded-full bg-muted-foreground/50" />
        Off
      </p>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <span className="flex items-center gap-2">
        <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
        Running at <code className="font-mono text-xs">{status.url}</code>
      </span>
      <CopyButton text={status.url} label="Copy URL" />
      <span className="text-muted-foreground">
        {status.lastRequestAt ? `Last request ${timeAgo(status.lastRequestAt).toLowerCase()}` : "No requests yet"}
      </span>
    </div>
  );
}

/**
 * Applies on Enter or blur; anything that isn't a valid port goes back to the current one.
 * Keyed by the port, so a saved change resets the draft.
 */
function PortInput({ port, onChange }: { port: number; onChange: (port: number) => void }) {
  const [draft, setDraft] = useState(String(port));

  const commit = () => {
    const next = Number(draft);
    if (Number.isInteger(next) && next >= 1024 && next <= 65535) {
      if (next !== port) onChange(next);
    } else {
      setDraft(String(port));
      toast.error("Pick a port between 1024 and 65535.");
    }
  };

  return (
    <Input
      id="settings-mcp-port"
      inputMode="numeric"
      className="w-24 text-right font-mono"
      placeholder={String(DEFAULT_MCP_PORT)}
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape" && draft !== String(port)) {
          e.stopPropagation();
          setDraft(String(port));
        }
      }}
    />
  );
}

/** Reveals claude_desktop_config.json, which Claude Desktop creates on first use of its settings. */
function ShowClaudeConfig() {
  const trpc = useTRPC();
  const show = useMutation(
    trpc.settings.showClaudeDesktopConfig.mutationOptions({ onError: (err) => toast.error(err.message) }),
  );
  return (
    <button type="button" className="text-foreground underline underline-offset-4" onClick={() => show.mutate()}>
      claude_desktop_config.json
    </button>
  );
}
