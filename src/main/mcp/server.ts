import http from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadAppState, saveAppState } from "@main/app-state";
import { DEFAULT_MCP_PORT, MCP_PATH, mcpUrl, type McpSettings, type McpStatus } from "@shared/mcp";
import { createMcpServer } from "./tools";

/**
 * The MCP server AI agents connect to, over Streamable HTTP on 127.0.0.1 while the app
 * runs. It's stateless: every POST gets a fresh server and transport, which call into the
 * same tRPC router as the UI, so agents share its database, cache and Apple rate limiting.
 *
 * There's no token: any local process can already open the database directly. What must be
 * kept out is web pages (including DNS rebinding), so requests need our exact Host header
 * and are refused if they carry an Origin, which browsers send and MCP clients don't.
 */

let settings: McpSettings = { enabled: false, port: DEFAULT_MCP_PORT, allowRemove: false };
let server: http.Server | null = null;
let error: string | null = null;
let lastRequestAt: Date | null = null;

export function getMcpStatus(): McpStatus {
  return { ...settings, running: !!server, url: mcpUrl(settings.port), error, lastRequestAt };
}

function isAllowedHost(host: string | undefined) {
  return host === `127.0.0.1:${settings.port}` || host === `localhost:${settings.port}`;
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.headers.origin !== undefined || !isAllowedHost(req.headers.host)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  if (new URL(req.url ?? "/", "http://127.0.0.1").pathname !== MCP_PATH) {
    res.writeHead(404).end("Not found");
    return;
  }
  // Stateless, so there's no stream to open (GET) or session to end (DELETE).
  if (req.method !== "POST") {
    res.writeHead(405, { Allow: "POST" }).end("Method not allowed");
    return;
  }

  lastRequestAt = new Date();
  const mcp = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    void transport.close();
    void mcp.close();
  });
  try {
    await mcp.connect(transport);
    await transport.handleRequest(req, res);
  } catch (err) {
    console.error("MCP request failed", err);
    if (!res.headersSent) res.writeHead(500).end("Internal error");
  }
}

function listen(port: number) {
  return new Promise<http.Server>((resolve, reject) => {
    const next = http.createServer((req, res) => void handle(req, res));
    next.once("error", reject);
    next.listen(port, "127.0.0.1", () => {
      next.off("error", reject);
      resolve(next);
    });
  });
}

async function stop() {
  if (!server) return;
  const current = server;
  server = null;
  current.closeAllConnections();
  await new Promise<void>((resolve) => current.close(() => resolve()));
}

/** Starts, stops or restarts the server to match the settings. */
async function apply() {
  await stop();
  error = null;
  if (!settings.enabled) return;
  try {
    server = await listen(settings.port);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    error =
      code === "EADDRINUSE"
        ? `Port ${settings.port} is in use by another app. Pick another port.`
        : `Couldn't start the server: ${err instanceof Error ? err.message : String(err)}`;
    console.error("MCP server failed to start", err);
  }
}

/** Loads the saved settings (only once the data folder is set) and starts the server if it's on. */
export function startMcpServer() {
  settings = { ...settings, ...loadAppState().mcp };
  return apply();
}

export async function updateMcpSettings(patch: Partial<McpSettings>) {
  const restart = patch.enabled !== undefined || (patch.port !== undefined && patch.port !== settings.port);
  settings = { ...settings, ...patch };
  saveAppState({ mcp: settings });
  // Tools are registered per request, so allowRemove applies from the next one.
  if (restart) await apply();
  return getMcpStatus();
}
