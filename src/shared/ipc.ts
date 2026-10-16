/**
 * tRPC over IPC: the renderer's tRPC client issues ordinary HTTP-shaped requests,
 * but its `fetch` sends them to the main process instead of the network. The main
 * process answers them with tRPC's fetch adapter, so batching, superjson and error
 * formatting all behave exactly as they would over HTTP.
 */
export const TRPC_CHANNEL = "trpc";

/** Placeholder origin for tRPC URLs; requests never leave the app. */
export const TRPC_URL = "http://openaso.internal/trpc";

export type IpcRequest = {
  url: string;
  method: string;
  headers: [string, string][];
  body: string | null;
};

export type IpcResponse = {
  status: number;
  headers: [string, string][];
  body: string;
};

export const THEME_CHANNEL = "theme";
export type ThemeSource = "light" | "dark" | "system";

/** File › New App… (⌘N) asks the renderer to open the add-app box. */
export const NEW_APP_CHANNEL = "menu:new-app";

export const UPDATE_CHANNEL = "update";
export const UPDATE_INSTALL_CHANNEL = "update:install";

/** A newer version, either downloaded and ready to install, or only announced (macOS, .deb). */
export type UpdateStatus =
  | { kind: "ready"; version: string }
  | { kind: "available"; version: string; url: string };

/** Exposed on `window.openaso` by the preload script. */
export type PreloadApi = {
  trpc: (request: IpcRequest) => Promise<IpcResponse>;
  /** Keeps native chrome (title bar, menus, dialogs) in the app's theme. */
  setTheme: (theme: ThemeSource) => void;
  /** Subscribes to update notifications; returns an unsubscribe function. */
  onUpdate: (callback: (status: UpdateStatus) => void) => () => void;
  /** Subscribes to File › New App…; returns an unsubscribe function. */
  onNewApp: (callback: () => void) => () => void;
  /** Quits and installs a downloaded update. */
  installUpdate: () => void;
  platform: NodeJS.Platform;
};
