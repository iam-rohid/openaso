// Connects MCP clients that only speak stdio (Claude Desktop) to OpenASO's MCP server.
//
// OpenASO copies this file into its data folder when the server is turned on, and the
// client runs it with OpenASO's own binary as plain Node (ELECTRON_RUN_AS_NODE=1), so
// nothing else needs installing. It reads newline-delimited JSON-RPC from stdin, POSTs
// each message to http://127.0.0.1:<port>/mcp, and writes the replies to stdout. The port
// comes from app-state.json next to this file, so changing it in Settings needs no config
// change. No dependencies: it runs outside the app bundle.

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const DEFAULT_PORT = 2776;
const NOT_RUNNING =
  "OpenASO isn't running, or its MCP server is off. Open OpenASO and turn on Settings → MCP Server.";

function serverUrl() {
  let port = DEFAULT_PORT;
  try {
    const state = JSON.parse(fs.readFileSync(path.join(__dirname, "app-state.json"), "utf8"));
    if (Number.isInteger(state.mcp?.port)) port = state.mcp.port;
  } catch {
    // No saved settings yet: the default port.
  }
  return `http://127.0.0.1:${port}/mcp`;
}

/** Sent back with requests after initialize, as the protocol asks. */
let protocolVersion = null;

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function sendError(id, message) {
  if (id === undefined || id === null) return;
  send({ jsonrpc: "2.0", id, error: { code: -32000, message } });
}

async function forward(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    return;
  }
  const id = Array.isArray(message) ? undefined : message.id;

  let res;
  try {
    res = await fetch(serverUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(protocolVersion && { "MCP-Protocol-Version": protocolVersion }),
      },
      body: line,
    });
  } catch {
    sendError(id, NOT_RUNNING);
    return;
  }

  // Notifications are accepted with no body.
  if (res.status === 202) return;
  const text = await res.text();
  if (!res.ok && !text.startsWith("{") && !text.startsWith("[")) {
    sendError(id, `OpenASO's MCP server responded ${res.status}: ${text || res.statusText}`);
    return;
  }
  try {
    const reply = JSON.parse(text);
    for (const item of Array.isArray(reply) ? reply : [reply]) {
      if (item.result?.protocolVersion) protocolVersion = item.result.protocolVersion;
      send(item);
    }
  } catch {
    sendError(id, "OpenASO's MCP server sent an unreadable reply.");
  }
}

const pending = new Set();
const input = readline.createInterface({ input: process.stdin });
input.on("line", (line) => {
  if (!line.trim()) return;
  const task = forward(line).finally(() => pending.delete(task));
  pending.add(task);
});
// Answer what's in flight before exiting when the client closes stdin.
input.on("close", () => void Promise.allSettled(pending).then(() => process.exit(0)));
