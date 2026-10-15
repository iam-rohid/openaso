import { TRPCError } from "@trpc/server";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { appFolders, trackedApps } from "@/server/db/schema";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { appIdInput, countryInput, folderIdInput } from "@/server/api/inputs";
import { FOLDER_COLORS, FOLDER_NAME_MAX } from "@/lib/folders";

const folderFields = z.object({
  name: z.string().trim().min(1).max(FOLDER_NAME_MAX),
  color: z.enum(FOLDER_COLORS),
});

export const foldersRouter = createTRPCRouter({
  /** Folders in sidebar order, with app/keyword counts for the active storefront and a few icons for previews. */
  list: publicProcedure.input(z.object({ country: countryInput })).query(async ({ ctx, input }) => {
    return ctx.db
      .select({
        id: appFolders.id,
        name: appFolders.name,
        color: appFolders.color,
        // Correlated subqueries use explicit aliases: drizzle leaves columns unqualified in single-table selects.
        appCount: sql<number>`(select count(*)::int from tracked_apps ta where ta.folder_id = ${appFolders}.id)`,
        keywordCount: sql<number>`(
          select count(*)::int from app_keywords ak
          join tracked_apps ta on ta.app_id = ak.app_id
          join keywords k on k.id = ak.keyword_id
          where ta.folder_id = ${appFolders}.id and k.country = ${input.country}
        )`,
        previewIcons: sql<(string | null)[]>`coalesce((
          select json_agg(t.icon_url) from (
            select a.icon_url from tracked_apps ta
            join apps a on a.id = ta.app_id
            where ta.folder_id = ${appFolders}.id
            order by ta.sort_order, ta.created_at
            limit 4
          ) t
        ), '[]'::json)`,
      })
      .from(appFolders)
      .orderBy(asc(appFolders.sortOrder), asc(appFolders.createdAt));
  }),

  get: publicProcedure.input(z.object({ id: folderIdInput })).query(async ({ ctx, input }) => {
    const [folder] = await ctx.db.select().from(appFolders).where(eq(appFolders.id, input.id));
    if (!folder) throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found" });
    return folder;
  }),

  /** Creates a folder at the end of the list, optionally moving an app into it. */
  create: publicProcedure
    .input(folderFields.extend({ appId: appIdInput.optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const [{ max }] = await tx
          .select({ max: sql<number>`coalesce(max(${appFolders.sortOrder}), 0)::int` })
          .from(appFolders);
        const [folder] = await tx
          .insert(appFolders)
          .values({ name: input.name, color: input.color, sortOrder: max + 1 })
          .returning();
        if (input.appId) {
          await tx.update(trackedApps).set({ folderId: folder.id }).where(eq(trackedApps.appId, input.appId));
        }
        return folder;
      });
    }),

  update: publicProcedure
    .input(folderFields.extend({ id: folderIdInput }))
    .mutation(async ({ ctx, input }) => {
      const [folder] = await ctx.db
        .update(appFolders)
        .set({ name: input.name, color: input.color })
        .where(eq(appFolders.id, input.id))
        .returning();
      if (!folder) throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found" });
      return folder;
    }),

  /** Deletes the folder only; its apps fall back to the top level via ON DELETE SET NULL. */
  delete: publicProcedure.input(z.object({ id: folderIdInput })).mutation(async ({ ctx, input }) => {
    return ctx.db.transaction(async (tx) => {
      const moved = await tx
        .select({ appId: trackedApps.appId })
        .from(trackedApps)
        .where(eq(trackedApps.folderId, input.id));
      await tx.delete(appFolders).where(eq(appFolders.id, input.id));
      return { movedCount: moved.length };
    });
  }),
});
