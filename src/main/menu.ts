import { app, Menu, shell, type MenuItemConstructorOptions } from "electron";

const REPO_URL = "https://github.com/iam-rohid/openaso";

export function buildMenu() {
  const isMac = process.platform === "darwin";
  const devItems: MenuItemConstructorOptions[] = app.isPackaged
    ? []
    : [{ role: "reload" }, { role: "forceReload" }, { role: "toggleDevTools" }, { type: "separator" }];

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: "appMenu" } as const] : []),
    { role: "fileMenu" },
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
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
