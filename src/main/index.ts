import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from "electron";
import { NEW_APP_CHANNEL, THEME_CHANNEL, type ThemeSource } from "@shared/ipc";
import { loadAppState, restorableBounds, saveAppState, trackWindowState } from "@main/app-state";
import { initDatabase } from "@main/db";
import { registerTrpcHandler } from "@main/ipc";
import { buildMenu } from "@main/menu";
import { startRankUpdates } from "@main/services/rank-updates";
import { checkForUpdatesInteractively, initUpdater } from "@main/updater";

// Keep development data apart from the installed app's.
if (!app.isPackaged) app.setPath("userData", path.join(app.getPath("appData"), "OpenASO Dev"));

let mainWindow: BrowserWindow | null = null;

const isMac = process.platform === "darwin";

function createWindow() {
  const state = loadAppState();
  const bounds = restorableBounds(state);
  const win = new BrowserWindow({
    width: bounds?.width ?? 1280,
    height: bounds?.height ?? 820,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 980,
    minHeight: 600,
    show: false,
    // Matches the page background so there's no flash before the renderer paints.
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0a0a0a" : "#ffffff",
    // macOS: no title bar; the traffic lights sit level with the page toolbar (56px tall).
    ...(isMac && { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 18, y: 21 } }),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (bounds && state.window?.maximized) win.maximize();
  trackWindowState(win);
  win.once("ready-to-show", () => win.show());

  // Links never open inside the app: web pages go to the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?|itms-apps):/.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(win.webContents.getURL().split("#")[0])) return;
    event.preventDefault();
    if (/^https?:/.test(url)) void shell.openExternal(url);
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });
  mainWindow = win;
  return win;
}

/** Opens and migrates the database; on failure, explains and quits. */
async function setUpDatabase() {
  const dataDir = app.getPath("userData");
  const file = path.join(dataDir, "openaso.db");
  const migrationsFolder = app.isPackaged
    ? path.join(process.resourcesPath, "drizzle")
    : path.join(app.getAppPath(), "drizzle");
  try {
    initDatabase(file, migrationsFolder);
    return true;
  } catch (err) {
    console.error("Failed to open the database", err);
    const { response } = await dialog.showMessageBox({
      type: "error",
      title: "OpenASO",
      message: "OpenASO couldn't open its database.",
      detail: `${err instanceof Error ? err.message : String(err)}\n\nDatabase: ${file}`,
      buttons: ["Quit", "Reveal Data Folder"],
      defaultId: 0,
    });
    if (response === 1) await shell.openPath(dataDir);
    return false;
  }
}

const THEMES: ThemeSource[] = ["light", "dark", "system"];

/** The renderer reports theme changes so native chrome follows, and the next launch starts in it. */
function registerThemeHandler() {
  ipcMain.on(THEME_CHANNEL, (_event, theme: ThemeSource) => {
    if (!THEMES.includes(theme) || nativeTheme.themeSource === theme) return;
    nativeTheme.themeSource = theme;
    saveAppState({ theme });
  });
}

// Two instances writing the same database would corrupt each other's view of it.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  void app.whenReady().then(async () => {
    nativeTheme.themeSource = loadAppState().theme ?? "dark";
    if (!(await setUpDatabase())) return app.quit();
    registerTrpcHandler();
    registerThemeHandler();
    buildMenu({
      onCheckForUpdates: () => void checkForUpdatesInteractively(),
      onNewApp: () => {
        // On macOS the app keeps running without a window; open one and ask once it has loaded.
        if (!mainWindow) {
          const win = createWindow();
          win.webContents.once("did-finish-load", () => win.webContents.send(NEW_APP_CHANNEL));
          return;
        }
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        mainWindow.webContents.send(NEW_APP_CHANNEL);
      },
    });
    createWindow();
    initUpdater(() => mainWindow);
    startRankUpdates();

    // macOS: clicking the dock icon reopens the window.
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
