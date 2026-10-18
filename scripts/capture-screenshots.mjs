// Captures the marketing site's app screenshots from the demo build.
//
//   pnpm dev:demo        # first, in another terminal: seeded demo data + remote debugging
//   pnpm screenshots     # writes www/src/assets/screenshots/*.png
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

const SHOTS = [{ name: "keywords", hash: `#/apps/${DEMO_APP}` }];

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

for (const shot of SHOTS) {
  await send("Runtime.evaluate", { expression: `location.hash = ${JSON.stringify(shot.hash)}` });
  // Park the pointer on empty sidebar space so no row shows its hover state.
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 150, y: HEIGHT - 200 });
  // Let queries settle and icons load.
  await wait(2500);
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  const file = path.join(OUT, `${shot.name}.png`);
  await fs.writeFile(file, Buffer.from(data, "base64"));
  console.log(`Saved ${path.relative(process.cwd(), file)}`);
}

await send("Emulation.clearDeviceMetricsOverride");
ws.close();
