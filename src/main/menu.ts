import { app, Menu, shell, type MenuItemConstructorOptions } from "electron";

const REPO_URL = "https://github.com/iam-rohid/openaso";

export function buildMenu({ onCheckForUpdates, onNewApp }: { onCheckForUpdates: () => void; onNewApp: () => void }) {
  const isMac = process.platform === "darwin";
  const devItems: MenuItemConstructorOptions[] = app.isPackaged
    ? []
    : [{ role: "reload" }, { role: "forceReload" }, { role: "toggleDevTools" }, { type: "separator" }];

  const checkForUpdates: MenuItemConstructorOptions[] = [
    { type: "separator" },
    { label: "Check for Updates…", click: onCheckForUpdates },
  ];

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { label: "Check for Updates…", click: onCheckForUpdates },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: "File",
      submenu: [
        { label: "New App…", accelerator: "CmdOrCtrl+N", click: onNewApp },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        ...devItems,
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        { label: "Open Data Folder", click: () => void shell.openPath(app.getPath("userData")) },
        { type: "separator" },
        { label: "View on GitHub", click: () => void shell.openExternal(REPO_URL) },
        { label: "Report an Issue", click: () => void shell.openExternal(`${REPO_URL}/issues`) },
        // macOS has it in the app menu.
        ...(isMac ? [] : checkForUpdates),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
