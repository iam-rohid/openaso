import { appsRouter } from "./routers/apps";
import { foldersRouter } from "./routers/folders";
import { keywordsRouter } from "./routers/keywords";
import { createCallerFactory, createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  apps: appsRouter,
  folders: foldersRouter,
  keywords: keywordsRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
