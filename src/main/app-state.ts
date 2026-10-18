import fs from "node:fs";
import path from "node:path";
import { app, type BrowserWindow, type Rectangle, screen } from "electron";
import type { ThemeSource } from "@shared/ipc";
import type { McpSettings } from "@shared/mcp";

/** Small bits of UI state the main process needs before the renderer has loaded. */
type AppState = {
  window?: { bounds: Rectangle; maximized: boolean };
  theme?: ThemeSource;
  /** Refresh tracked keywords once a day in the background (on unless turned off). */
  autoUpdateRankings?: boolean;
  /** The MCP server for AI agents (off unless turned on in Settings). */
  mcp?: McpSettings;
};

const file = () => path.join(app.getPath("userData"), "app-state.json");

export function loadAppState(): AppState {
  try {
    return JSON.parse(fs.readFileSync(file(), "utf8")) as AppState;
  } catch {
    return {};
  }
}

export function saveAppState(patch: Partial<AppState>) {
  try {
    fs.writeFileSync(file(), JSON.stringify({ ...loadAppState(), ...patch }, null, 2));
  } catch (err) {
    console.error("Failed to save app state", err);
  }
}

/** Saved bounds, unless the display they were on is gone (e.g. an unplugged monitor). */
export function restorableBounds(state: AppState): Rectangle | undefined {
  const bounds = state.window?.bounds;
  if (!bounds) return undefined;
  const visible = screen.getAllDisplays().some(({ workArea: a }) => {
    const overlapX = Math.min(bounds.x + bounds.width, a.x + a.width) - Math.max(bounds.x, a.x);
    const overlapY = Math.min(bounds.y + bounds.height, a.y + a.height) - Math.max(bounds.y, a.y);
    return overlapX >= 100 && overlapY >= 50;
  });
  return visible ? bounds : undefined;
}

/** Remembers the window's size, position and maximized state across launches. */
export function trackWindowState(win: BrowserWindow) {
  let timer: NodeJS.Timeout | undefined;
  const save = () => {
    clearTimeout(timer);
    if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
    // `getNormalBounds` is the restored size, so un-maximizing next launch lands somewhere sensible.
    saveAppState({ window: { bounds: win.getNormalBounds(), maximized: win.isMaximized() } });
  };
  const saveSoon = () => {
    clearTimeout(timer);
    timer = setTimeout(save, 500);
  };
  win.on("resize", saveSoon);
  win.on("move", saveSoon);
  win.on("maximize", save);
  win.on("unmaximize", save);
  win.on("close", save);
}
