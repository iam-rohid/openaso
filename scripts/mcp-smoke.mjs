// Exercises the MCP server end to end against the demo build, with the official SDK client.
//
//   pnpm dev:demo        # first, in another terminal, with the MCP server on in Settings
//   pnpm mcp:smoke       # calls every tool and checks the server refuses browsers
//   pnpm mcp:smoke -- --bridge  # the same, through the stdio bridge Claude Desktop uses
//
// Write tools only run when "Allow agents to remove data" is on, so the script can remove
// what it adds and leave the demo data as it was. With it off, it checks the remove tools
// are hidden. It calls Apple's endpoints for uncached keywords, so it isn't part of CI.

import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const URL_ = process.env.OPENASO_MCP_URL ?? "http://127.0.0.1:2776/mcp";
/** Tracked in the demo database. */
const DEMO_APP = "1480220328";
const REMOVE_TOOLS = ["untrack_app", "remove_keywords", "delete_folder"];
/** The demo's data folder, where the app installs the bridge. */
const DEMO_DATA = path.join(os.homedir(), "Library/Application Support/OpenASO Demo");
const viaBridge = process.argv.includes("--bridge");

let failures = 0;
async function step(name, fn) {
  try {
    const detail = await fn();
    console.log(`✓ ${name}${detail ? `  ${detail}` : ""}`);
  } catch (err) {
    failures++;
    console.log(`✗ ${name}\n  ${err instanceof Error ? err.message : err}`);
  }
}

const client = new Client({ name: "openaso-smoke", version: "1.0.0" });

/** Calls a tool and returns its parsed JSON, failing on tool errors. */
async function call(name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content?.[0]?.text ?? "";
  if (result.isError) throw new Error(`${name} failed: ${text}`);
  return JSON.parse(text);
}

/** Status of a bare POST with these headers (node:http, since fetch won't send a custom Host). */
function status(headers) {
  return new Promise((resolve, reject) => {
    const req = http.request(URL_, { method: "POST", headers }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on("error", reject);
    req.end("{}");
  });
}

await step("refuses browser requests (Origin)", async () => {
  assert.equal(await status({ Origin: "https://example.com" }), 403);
});
await step("refuses other hosts (DNS rebinding)", async () => {
  assert.equal(await status({ Host: "example.com:2776" }), 403);
});

await step(viaBridge ? "connects through the stdio bridge" : "connects", async () => {
  // The bridge runs as plain Node here; Claude Desktop runs it with OpenASO's binary as Node.
  const transport = viaBridge
    ? new StdioClientTransport({ command: process.execPath, args: [path.join(DEMO_DATA, "mcp-bridge.cjs")] })
    : new StreamableHTTPClientTransport(new URL(URL_));
  await client.connect(transport);
  const instructions = client.getInstructions();
  assert.ok(instructions?.includes("popularity"), "has instructions");
  return client.getServerVersion()?.version;
});

let canRemove = false;
await step("lists tools", async () => {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  for (const name of ["list_apps", "get_app_keywords", "explore_keywords", "add_keywords", "track_app"]) {
    assert.ok(names.includes(name), `has ${name}`);
  }
  canRemove = REMOVE_TOOLS.every((name) => names.includes(name));
  assert.ok(canRemove || REMOVE_TOOLS.every((name) => !names.includes(name)), "remove tools all or none");
  for (const tool of tools.filter((t) => REMOVE_TOOLS.includes(t.name))) {
    assert.equal(tool.annotations?.destructiveHint, true, `${tool.name} is marked destructive`);
  }
  return `${names.length} tools, remove tools ${canRemove ? "on" : "hidden"}`;
});

await step("lists prompts", async () => {
  const { prompts } = await client.listPrompts();
  assert.deepEqual(prompts.map((p) => p.name).sort(), [
    "competitor_gap",
    "keyword_research",
    "new_app_keywords",
    "ranking_report",
  ]);
  const { messages } = await client.getPrompt({ name: "keyword_research", arguments: { app: "Tiimo", country: "us" } });
  assert.match(messages[0].content.text, /Tiimo in the US storefront/);
});

await step("list_apps", async () => {
  const { apps, folders } = await call("list_apps");
  assert.ok(apps.some((a) => a.id === DEMO_APP), "demo app is tracked");
  return `${apps.length} apps, folders: ${folders.join(", ")}`;
});

await step("get_app (by name)", async () => {
  const { apps } = await call("list_apps");
  const name = apps.find((a) => a.id === DEMO_APP).name;
  const app = await call("get_app", { app: name });
  assert.equal(app.id, DEMO_APP);
  return app.name;
});

await step("get_app (unknown name gives a helpful error)", async () => {
  const result = await client.callTool({ name: "get_app", arguments: { app: "no such app zzz" } });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /list_apps/);
});

await step("get_app_keywords", async () => {
  const data = await call("get_app_keywords", { app: DEMO_APP, includeHistory: true, limit: 5 });
  assert.ok(data.keywords.length > 0, "has keywords");
  assert.ok(Array.isArray(data.keywords[0].history), "has history");
  return `${data.total} keywords in ${data.country}`;
});

await step("get_ranking_summary", async () => {
  const data = await call("get_ranking_summary", { app: DEMO_APP, window: "30d" });
  assert.ok(data.now, "has counts");
  return JSON.stringify(data.now);
});

await step("get_keyword_history", async () => {
  const { keywords } = await call("get_app_keywords", { app: DEMO_APP, limit: 1 });
  const data = await call("get_keyword_history", { term: keywords[0].term, app: DEMO_APP });
  assert.ok(data.days.length > 0, "has days");
  return `${data.days.length} days for "${data.term}"`;
});

await step("search_app_store", async () => {
  const data = await call("search_app_store", { query: "meal planner", limit: 3 });
  assert.ok(data.apps.length > 0);
  return data.apps.map((a) => a.name).join(", ");
});

await step("explore_keywords", async () => {
  const data = await call("explore_keywords", { terms: ["meal planner", "Recipe Keeper"], app: DEMO_APP });
  assert.equal(data.keywords.length + (data.failed?.length ?? 0), 2);
  return data.keywords.map((k) => `${k.term}: pop ${k.popularity}, diff ${k.difficulty}, #${k.position}`).join("; ");
});

await step("get_keyword_ranking", async () => {
  const data = await call("get_keyword_ranking", { term: "meal planner", limit: 5 });
  assert.equal(data.apps.length, 5);
  return data.apps.map((a) => `${a.position}. ${a.name}`).join(", ");
});

await step("get_autocomplete", async () => {
  const data = await call("get_autocomplete", { term: "meal" });
  return data.suggestions.slice(0, 4).join(", ");
});

await step("get_keyword_suggestions", async () => {
  const data = await call("get_keyword_suggestions", { app: DEMO_APP });
  assert.ok(data.suggestions.length > 0);
  return data.suggestions.slice(0, 5).map((s) => s.term).join(", ");
});

await step("discover_app_keywords", async () => {
  const data = await call("discover_app_keywords", { app: DEMO_APP, limit: 3 });
  return `checked ${data.checked}, ranks for ${data.ranked}`;
});

await step("rejects an unknown storefront", async () => {
  const result = await client.callTool({ name: "get_autocomplete", arguments: { term: "meal", country: "XX" } });
  assert.equal(result.isError, true);
});

if (canRemove) {
  let placeholder;
  let target;
  await step("create_unreleased_app", async () => {
    ({ app: placeholder } = await call("create_unreleased_app", { name: "Smoke Test App" }));
    return placeholder.id;
  });
  await step("add_keywords (to the unreleased app, by name)", async () => {
    const data = await call("add_keywords", { app: "Smoke Test App", terms: ["meal planner", "recipe keeper"] });
    assert.equal(data.keywords.length, 2);
    return `added ${data.added}`;
  });
  await step("add_keywords (untracked app fails helpfully)", async () => {
    const result = await client.callTool({ name: "add_keywords", arguments: { app: "284882215", terms: ["x"] } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /track_app/);
  });
  await step("set_keyword_note", async () => {
    const data = await call("set_keyword_note", { app: placeholder.id, term: "Meal Planner", note: "from the smoke test" });
    assert.equal(data.note, "from the smoke test");
  });
  await step("refresh_app_keywords (nothing stale)", async () => {
    const data = await call("refresh_app_keywords", { app: placeholder.id });
    assert.equal(data.refreshed, 0);
  });
  await step("link_unreleased_app (to an untracked App Store app)", async () => {
    const { apps: tracked } = await call("list_apps");
    const { apps } = await call("search_app_store", { query: "recipe keeper", limit: 20 });
    target = apps.find((a) => !tracked.some((t) => t.id === a.id));
    const data = await call("link_unreleased_app", { app: placeholder.id, target: target.id });
    assert.equal(data.movedKeywords, 2);
    return `${placeholder.id} → ${data.app.name}`;
  });
  await step("track_app (already tracked)", async () => {
    const data = await call("track_app", { app: target.id });
    assert.equal(data.alreadyTracked, true);
  });
  await step("remove_keywords", async () => {
    const data = await call("remove_keywords", { app: target.id, terms: ["meal planner", "recipe keeper", "nope"] });
    assert.equal(data.removed.length, 2);
    assert.deepEqual(data.notTracked, ["nope"]);
  });
  await step("untrack_app", async () => {
    await call("untrack_app", { app: target.id });
    const { apps } = await call("list_apps");
    assert.ok(!apps.some((a) => a.id === target.id || a.name === "Smoke Test App"), "cleaned up");
  });
  await step("delete_folder (unknown folder fails helpfully)", async () => {
    const result = await client.callTool({ name: "delete_folder", arguments: { folder: "No such folder" } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /Folders:/);
  });
} else {
  console.log("- write tools skipped: turn on \"Allow agents to remove data\" so the test can clean up after itself");
}

await client.close();
console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
