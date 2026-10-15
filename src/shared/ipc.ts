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

/** Exposed on `window.openaso` by the preload script. */
export type PreloadApi = {
  trpc: (request: IpcRequest) => Promise<IpcResponse>;
  platform: NodeJS.Platform;
};
