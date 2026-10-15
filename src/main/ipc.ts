import { ipcMain, type WebFrameMain } from "electron";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { TRPC_CHANNEL, TRPC_URL, type IpcRequest, type IpcResponse } from "@shared/ipc";
import { appRouter } from "@main/api/root";
import { createTRPCContext } from "@main/api/trpc";

/** Only our own renderer (dev server or packaged files) may call the API. */
function isTrusted(frame: WebFrameMain | null) {
  if (!frame) return false;
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  return devUrl ? frame.url.startsWith(devUrl) : frame.url.startsWith("file://");
}

export function registerTrpcHandler() {
  ipcMain.handle(TRPC_CHANNEL, async (event, request: IpcRequest): Promise<IpcResponse> => {
    if (!isTrusted(event.senderFrame)) throw new Error("Untrusted IPC sender");
    if (!request.url.startsWith(`${TRPC_URL}/`)) throw new Error("Unknown tRPC URL");

    const response = await fetchRequestHandler({
      endpoint: new URL(TRPC_URL).pathname,
      req: new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      }),
      router: appRouter,
      createContext: createTRPCContext,
      onError: import.meta.env.DEV
        ? ({ path, error }) => console.error(`❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`)
        : undefined,
    });

    return { status: response.status, headers: [...response.headers], body: await response.text() };
  });
}
