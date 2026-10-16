import { contextBridge, ipcRenderer } from "electron";
import {
  NEW_APP_CHANNEL,
  THEME_CHANNEL,
  TRPC_CHANNEL,
  UPDATE_CHANNEL,
  UPDATE_INSTALL_CHANNEL,
  type PreloadApi,
  type UpdateStatus,
} from "@shared/ipc";

const api: PreloadApi = {
  trpc: (request) => ipcRenderer.invoke(TRPC_CHANNEL, request),
  setTheme: (theme) => ipcRenderer.send(THEME_CHANNEL, theme),
  onUpdate: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => callback(status);
    ipcRenderer.on(UPDATE_CHANNEL, listener);
    return () => ipcRenderer.removeListener(UPDATE_CHANNEL, listener);
  },
  onNewApp: (callback) => {
    const listener = () => callback();
    ipcRenderer.on(NEW_APP_CHANNEL, listener);
    return () => ipcRenderer.removeListener(NEW_APP_CHANNEL, listener);
  },
  installUpdate: () => ipcRenderer.send(UPDATE_INSTALL_CHANNEL),
  platform: process.platform,
};

contextBridge.exposeInMainWorld("openaso", api);
