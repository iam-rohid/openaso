import { appsRouter } from "./routers/apps";
import { foldersRouter } from "./routers/folders";
import { keywordsRouter } from "./routers/keywords";
import { rankUpdatesRouter } from "./routers/rank-updates";
import { settingsRouter } from "./routers/settings";
import { createCallerFactory, createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  apps: appsRouter,
  folders: foldersRouter,
  keywords: keywordsRouter,
  rankUpdates: rankUpdatesRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
