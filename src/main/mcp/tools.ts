import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { app as electronApp } from "electron";
import { initCaller } from "./common";
import { registerPrompts } from "./prompts";
import { registerReadTools, registerResearchTools } from "./read-tools";
import { registerRemoveTools, registerWriteTools } from "./write-tools";

/**
 * One MCP server per request, with the tools, prompts and instructions agents see. Tools
 * go through the same tRPC router as the UI and reshape its output for agents: keywords by
 * term rather than id, apps by id, link or name, and compact JSON without UI-only fields.
 */

const INSTRUCTIONS = `OpenASO is a local App Store Optimization app. These tools research App Store keywords and manage the apps and keywords the user tracks.

- Apps: pass a numeric App Store id, an apps.apple.com link, or the name of a tracked app (see list_apps). Use search_app_store to find other apps.
- Storefronts: "country" is a two-letter App Store code (US, GB, DE…). It defaults to the app's storefront, else US. Always tell the user which storefront the data is for.
- popularity (5–100) estimates how often a term is searched; difficulty (0–100) how hard it is to rank in its top results. Both are estimates from Apple's public data, not Apple's own numbers.
- position is the app's rank in search results (1 = first); null means it isn't in the ~250 results Apple returns.
- trend.delta is positive when the app moved up. trend.state "new"/"lost" means it entered or dropped out of the results.
- Keyword data is cached for 24 hours and refreshed daily for tracked keywords. Every uncached lookup costs requests against Apple's rate limit, so prefer cached data, look keywords up in batches with explore_keywords, and don't refresh what isn't stale.
- If Apple is rate limiting, wait a few minutes before trying again and work with the data you have.
- Tracking: track_app adds an App Store app; create_unreleased_app adds a placeholder for an app that isn't live yet. add_keywords tracks keywords for an app, and tracked keywords get a ranking point every day. Changes show up in the OpenASO window right away.`;

export function createMcpServer({ allowRemove }: { allowRemove: boolean }) {
  initCaller();
  const server = new McpServer(
    { name: "openaso", title: "OpenASO", version: electronApp.getVersion() },
    { instructions: INSTRUCTIONS },
  );
  registerReadTools(server);
  registerResearchTools(server);
  registerWriteTools(server);
  // Left out entirely unless the user allows it, so agents can't even see them.
  if (allowRemove) registerRemoveTools(server);
  registerPrompts(server);
  return server;
}
