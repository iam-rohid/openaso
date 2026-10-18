// Exercises the MCP server end to end against the demo build, with the official SDK client.
//
//   pnpm dev:demo        # first, in another terminal, with the MCP server on in Settings
//   pnpm mcp:smoke       # calls every tool and checks the server refuses browsers
//
// It calls Apple's endpoints for uncached keywords, so it isn't part of CI.

import assert from "node:assert/strict";
import http from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const URL_ = process.env.OPENASO_MCP_URL ?? "http://127.0.0.1:2776/mcp";
/** Tracked in the demo database. */
const DEMO_APP = "1480220328";

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

await step("connects", async () => {
  await client.connect(new StreamableHTTPClientTransport(new URL(URL_)));
  const instructions = client.getInstructions();
  assert.ok(instructions?.includes("popularity"), "has instructions");
  return client.getServerVersion()?.version;
});

await step("lists tools", async () => {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  for (const name of ["list_apps", "get_app_keywords", "explore_keywords", "get_keyword_ranking"]) {
    assert.ok(names.includes(name), `has ${name}`);
  }
  return `${names.length} tools`;
});

await step("list_apps", async () => {
  const apps = await call("list_apps");
  assert.ok(apps.some((a) => a.id === DEMO_APP), "demo app is tracked");
  return `${apps.length} apps`;
});

await step("get_app (by name)", async () => {
  const apps = await call("list_apps");
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

await client.close();
console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
