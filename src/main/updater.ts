import { app, type BrowserWindow, dialog, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import { UPDATE_CHANNEL, UPDATE_INSTALL_CHANNEL, type UpdateStatus } from "@shared/ipc";

const RELEASES_URL = "https://github.com/iam-rohid/openaso/releases";

/**
 * Only the Windows installer and the AppImage can replace themselves. The unsigned
 * macOS build (Squirrel.Mac needs a signature) and the .deb just announce new versions.
 */
const canInstall = process.platform === "win32" || Boolean(process.env.APPIMAGE);

let status: UpdateStatus | null = null;
let getWindow: () => BrowserWindow | null = () => null;

function publish(next: UpdateStatus) {
  status = next;
  getWindow()?.webContents.send(UPDATE_CHANNEL, status);
}

export function initUpdater(windowGetter: () => BrowserWindow | null) {
  getWindow = windowGetter;
  ipcMain.on(UPDATE_INSTALL_CHANNEL, () => {
    if (status?.kind === "ready") autoUpdater.quitAndInstall();
  });
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = canInstall;
  autoUpdater.autoInstallOnAppQuit = canInstall;
  autoUpdater.on("update-available", ({ version }) => {
    if (!canInstall) publish({ kind: "available", version, url: `${RELEASES_URL}/tag/v${version}` });
  });
  autoUpdater.on("update-downloaded", ({ version }) => publish({ kind: "ready", version }));
  // Being offline or rate limited shouldn't bother anyone; the next launch tries again.
  autoUpdater.on("error", (err) => console.error("Update check failed:", err.message));

  void autoUpdater.checkForUpdates().catch(() => {});
}

/** Re-sends a pending update to a window that (re)loaded after it was found. */
export function resendUpdateStatus(win: BrowserWindow) {
  if (status) win.webContents.send(UPDATE_CHANNEL, status);
}

/** "Check for Updates…" in the menu: like the launch check, but always reports back. */
export async function checkForUpdatesInteractively() {
  const win = getWindow();
  const show = (message: string, detail?: string) =>
    win
      ? dialog.showMessageBox(win, { type: "info", message, detail })
      : dialog.showMessageBox({ type: "info", message, detail });

  if (!app.isPackaged) return void show("Updates are only checked in the installed app.");
  if (status) return void show(`OpenASO ${status.version} is available.`, updateDetail(status));
  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result?.isUpdateAvailable) {
      return void show("You're up to date.", `OpenASO ${app.getVersion()} is the latest version.`);
    }
    // The update-available handler has set (or, on auto-install platforms, will set) `status`.
    show(`OpenASO ${result.updateInfo.version} is available.`, status ? updateDetail(status) : "Downloading…");
  } catch (err) {
    show("Couldn't check for updates.", err instanceof Error ? err.message : String(err));
  }
}

function updateDetail(update: UpdateStatus) {
  return update.kind === "ready"
    ? "It has been downloaded and will be installed when you restart OpenASO."
    : "Download it from the release page.";
}
