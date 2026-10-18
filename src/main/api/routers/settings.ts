import { app, shell } from "electron";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@main/api/trpc";
import { getMcpStatus, updateMcpSettings } from "@main/mcp/server";
import { checkForUpdatesInteractively } from "@main/updater";

/** The Settings dialog: app info and the MCP server. */
export const settingsRouter = createTRPCRouter({
  about: publicProcedure.query(() => ({ version: app.getVersion(), dataFolder: app.getPath("userData") })),

  openDataFolder: publicProcedure.mutation(() => void shell.openPath(app.getPath("userData"))),

  /** Reports back in a native dialog, like the menu item. */
  checkForUpdates: publicProcedure.mutation(() => checkForUpdatesInteractively()),

  mcpStatus: publicProcedure.query(() => getMcpStatus()),

  updateMcp: publicProcedure
    .input(
      z.object({
        enabled: z.boolean().optional(),
        port: z.number().int().min(1024).max(65535).optional(),
        allowRemove: z.boolean().optional(),
      }),
    )
    .mutation(({ input }) => updateMcpSettings(input)),
});
