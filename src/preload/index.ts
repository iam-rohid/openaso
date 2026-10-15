import { contextBridge, ipcRenderer } from "electron";
import { THEME_CHANNEL, TRPC_CHANNEL, type PreloadApi } from "@shared/ipc";

const api: PreloadApi = {
  trpc: (request) => ipcRenderer.invoke(TRPC_CHANNEL, request),
  setTheme: (theme) => ipcRenderer.send(THEME_CHANNEL, theme),
  platform: process.platform,
};

contextBridge.exposeInMainWorld("openaso", api);
