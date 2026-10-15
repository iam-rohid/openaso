import { contextBridge, ipcRenderer } from "electron";
import { TRPC_CHANNEL, type PreloadApi } from "@shared/ipc";

const api: PreloadApi = {
  trpc: (request) => ipcRenderer.invoke(TRPC_CHANNEL, request),
  platform: process.platform,
};

contextBridge.exposeInMainWorld("openaso", api);
