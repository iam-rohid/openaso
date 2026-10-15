import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";

// Keyword fetches fan out to several Apple endpoints; give them room to finish.
export const maxDuration = 300;

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => console.error(`❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`)
        : undefined,
  });

export { handler as GET, handler as POST };
