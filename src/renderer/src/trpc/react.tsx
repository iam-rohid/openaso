import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCContext, createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import superjson from "superjson";
import type { AppRouter } from "@main/api/root";
import { TRPC_URL } from "@shared/ipc";
import { queryClient } from "./query-client";

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

/** A `fetch` that hands tRPC's HTTP requests to the main process over IPC. */
const ipcFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const res = await window.openaso.trpc({
    url: input.toString(),
    method: init?.method ?? "GET",
    headers: [...new Headers(init?.headers)],
    body: typeof init?.body === "string" ? init.body : null,
  });
  return new Response(res.body, { status: res.status, headers: res.headers });
};

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    loggerLink({
      enabled: (op) => import.meta.env.DEV || (op.direction === "down" && op.result instanceof Error),
    }),
    httpBatchLink({ url: TRPC_URL, transformer: superjson, fetch: ipcFetch }),
  ],
});

/** Query options for use outside React, e.g. in route loaders; shares the hooks' cache keys. */
export const trpc = createTRPCOptionsProxy<AppRouter>({ client: trpcClient, queryClient });

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
