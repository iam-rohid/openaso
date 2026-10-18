// Captures the marketing site's app screenshots from the demo build.
//
//   pnpm dev:demo        # first, in another terminal: seeded demo data + remote debugging
//   pnpm screenshots     # writes www/src/assets/screenshots/*.png
//   pnpm screenshots mcp # or only the shots named
//
// Pages are rendered at a fixed size and 2x scale through the Chrome DevTools protocol,
// so the shots don't depend on the window's size or the screen it's on.

import fs from "node:fs/promises";
import path from "node:path";

const PORT = 9229;
const OUT = path.resolve(import.meta.dirname, "../www/src/assets/screenshots");
const DEMO_APP = "1480220328";
const WIDTH = 1440;
const HEIGHT = 900;

/** Clicks the first button whose text starts with `text`, optionally in the table row for keyword `row`. */
const click = (text, row) => `(() => {
  const scope = ${row ? `[...document.querySelectorAll("tr")].find((tr) => [...tr.cells].some((td) => td.textContent.trim() === ${JSON.stringify(row)}))` : "document"};
  const button = [...scope.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith(${JSON.stringify(text)}));
  if (!button) throw new Error("No button " + ${JSON.stringify(text)});
  button.click();
})()`;

/** Opens Settings → MCP Server, with the Claude Desktop snippet showing an installed app's paths. */
const mcpSettings = `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  ${click("Settings")};
  await wait(500);
  ${click("MCP Server")};
  await wait(500);
  // Removing data is off by default; show it that way.
  const row = [...document.querySelectorAll("[role=switch]")].find((s) => s.closest("div")?.parentElement?.textContent.includes("Allow agents to remove data"));
  if (row?.getAttribute("aria-checked") === "true") row.click();
  // The demo runs from a checkout, so swap in the paths an installed app would show.
  const pre = document.querySelector("[role=dialog] pre");
  pre.textContent = pre.textContent
    .replace(/"command": ".*?"/, '"command": "/Applications/OpenASO.app/Contents/MacOS/OpenASO"')
    .replace(/"[^"]*mcp-bridge\\.cjs"/, '"/Users/you/Library/Application Support/OpenASO/mcp-bridge.cjs"');
})()`;

const SHOTS = [
  { name: "keywords", hash: `#/apps/${DEMO_APP}` },
  { name: "history", hash: `#/apps/${DEMO_APP}`, setup: click("Movers & history") },
  { name: "ranking", hash: `#/apps/${DEMO_APP}`, setup: click("#", "planner") },
  { name: "suggestions", hash: `#/apps/${DEMO_APP}`, setup: click("Get Suggestions"), settle: 12000 },
  { name: "mcp", hash: "#/", setup: mcpSettings },
];

const targets = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json());
const page = targets.find((t) => t.type === "page");
if (!page) throw new Error("No page target; is `pnpm dev:demo` running?");

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let nextId = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  const call = pending.get(msg.id);
  if (!call) return;
  pending.delete(msg.id);
  if (msg.error) call.reject(new Error(msg.error.message));
  else call.resolve(msg.result);
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await send("Emulation.setDeviceMetricsOverride", {
  width: WIDTH,
  height: HEIGHT,
  deviceScaleFactor: 2,
  mobile: false,
});
await fs.mkdir(OUT, { recursive: true });

const only = process.argv.slice(2);
for (const shot of SHOTS.filter((s) => !only.length || only.includes(s.name))) {
  // Reload so dialogs and panels from the previous shot are gone.
  await send("Runtime.evaluate", { expression: `location.hash = ${JSON.stringify(shot.hash)}` });
  await send("Runtime.evaluate", { expression: "location.reload()" });
  await wait(2500);
  if (shot.setup) {
    const { exceptionDetails } = await send("Runtime.evaluate", {
      expression: shot.setup,
      awaitPromise: true,
    });
    if (exceptionDetails) throw new Error(`${shot.name}: ${exceptionDetails.exception?.description}`);
  }
  // Park the pointer on empty sidebar space so no row shows its hover state.
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 150, y: HEIGHT - 200 });
  // Let queries settle and icons load.
  await wait(shot.settle ?? 2500);
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  const file = path.join(OUT, `${shot.name}.png`);
  await fs.writeFile(file, Buffer.from(data, "base64"));
  console.log(`Saved ${path.relative(process.cwd(), file)}`);
}

await send("Emulation.clearDeviceMetricsOverride");
ws.close();
