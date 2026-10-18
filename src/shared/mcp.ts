/** "ASO" on a phone keypad; next to nothing else listens here. */
export const DEFAULT_MCP_PORT = 2776;
export const MCP_PATH = "/mcp";

export const mcpUrl = (port: number) => `http://127.0.0.1:${port}${MCP_PATH}`;

export type McpSettings = {
  enabled: boolean;
  port: number;
  /** Registers the tools that untrack apps and remove keywords. */
  allowRemove: boolean;
};

export type McpStatus = McpSettings & {
  running: boolean;
  url: string;
  /** Why the server isn't running although it's enabled, e.g. the port is taken. */
  error: string | null;
  lastRequestAt: Date | null;
  claudeDesktop: ClaudeDesktopSetup;
};

/** Claude Desktop only runs stdio servers, so it launches the bundled bridge with OpenASO's binary. */
export type ClaudeDesktopSetup = {
  server: { command: string; args: string[]; env: Record<string, string> };
  configPath: string;
};

/** Setup guide for every client, on the website. */
export const MCP_GUIDE_URL = "https://openaso.byteform.co/mcp";
