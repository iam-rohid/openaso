import { app, type BrowserWindow, dialog, ipcMain, shell } from "electron";
import { autoUpdater, type UpdateInfo } from "electron-updater";
import {
  UPDATE_CHANNEL,
  UPDATE_GET_CHANNEL,
  UPDATE_INSTALL_CHANNEL,
  type UpdateStatus,
} from "@shared/ipc";

const RELEASES_URL = "https://github.com/iam-rohid/openaso/releases";

/** Every build replaces itself except the .deb, which needs a package manager (and root). */
const canInstall = process.platform !== "linux" || Boolean(process.env.APPIMAGE);

const HOUR = 60 * 60 * 1000;
/** Checks while the app is running; well within GitHub's 60 unauthenticated requests an hour. */
const CHECK_INTERVAL = 4 * HOUR;
/** Focusing the window (e.g. after the laptop wakes) checks again if the last check is this old. */
const FOCUS_CHECK_AFTER = HOUR;

let status: UpdateStatus | null = null;
let lastCheck = 0;
let getWindow: () => BrowserWindow | null = () => null;

function publish(next: UpdateStatus) {
  status = next;
  getWindow()?.webContents.send(UPDATE_CHANNEL, status);
}

/** GitHub releases come with their body rendered to HTML. */
function releaseNotes({ releaseNotes }: UpdateInfo) {
  if (Array.isArray(releaseNotes)) return releaseNotes.map((n) => n.note ?? "").join("") || null;
  return releaseNotes || null;
}

function check() {
  lastCheck = Date.now();
  // Being offline or rate limited shouldn't bother anyone; the next check tries again.
  void autoUpdater.checkForUpdates().catch(() => {});
}

export function initUpdater(windowGetter: () => BrowserWindow | null) {
  getWindow = windowGetter;
  ipcMain.handle(UPDATE_GET_CHANNEL, () => status);
  ipcMain.on(UPDATE_INSTALL_CHANNEL, () => {
    if (status?.kind === "ready") autoUpdater.quitAndInstall();
  });
  if (!app.isPackaged) return;

  // Downloads happen in the background; the sidebar only speaks up once one is ready, and an
  // update nobody restarts for installs when the app quits.
  autoUpdater.autoDownload = canInstall;
  autoUpdater.autoInstallOnAppQuit = canInstall;
  autoUpdater.on("update-available", (info) => {
    if (!canInstall) {
      publish({ kind: "available", version: info.version, notes: releaseNotes(info), url: `${RELEASES_URL}/tag/v${info.version}` });
    }
  });
  // Also fires again for a newer release found after an earlier one was downloaded.
  autoUpdater.on("update-downloaded", (info) => publish({ kind: "ready", version: info.version, notes: releaseNotes(info) }));
  autoUpdater.on("error", (err) => console.error("Update check failed:", err.message));

  check();
  setInterval(check, CHECK_INTERVAL);
  app.on("browser-window-focus", () => {
    if (Date.now() - lastCheck >= FOCUS_CHECK_AFTER) check();
  });
}

/** "Check for Updates…" in the menu: like the background check, but always reports back. */
export async function checkForUpdatesInteractively() {
  const win = getWindow();
  const show = (options: Electron.MessageBoxOptions) =>
    win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options);
  const info = (message: string, detail?: string) => void show({ type: "info", message, detail });

  if (!app.isPackaged) return info("Updates are only checked in the installed app.");
  if (status) return offer(status, show);
  try {
    lastCheck = Date.now();
    const result = await autoUpdater.checkForUpdates();
    if (!result?.isUpdateAvailable) {
      return info("You're up to date.", `OpenASO ${app.getVersion()} is the latest version.`);
    }
    // Already downloaded (or announced): the event handlers have set `status`.
    if (status) return offer(status, show);
    info(
      `OpenASO ${result.updateInfo.version} is downloading.`,
      "A restart button will appear at the bottom of the sidebar when it's ready.",
    );
  } catch (err) {
    info("Couldn't check for updates.", err instanceof Error ? err.message : String(err));
  }
}

async function offer(
  update: UpdateStatus,
  show: (options: Electron.MessageBoxOptions) => Promise<Electron.MessageBoxReturnValue>,
) {
  const ready = update.kind === "ready";
  const { response } = await show({
    type: "info",
    message: `OpenASO ${update.version} is available.`,
    detail: ready
      ? "It's downloaded and will be installed when you restart OpenASO."
      : "Download it from the release page.",
    buttons: [ready ? "Restart Now" : "Download", "Later"],
    defaultId: 0,
    cancelId: 1,
  });
  if (response !== 0) return;
  if (update.kind === "ready") autoUpdater.quitAndInstall();
  else void shell.openExternal(update.url);
}
