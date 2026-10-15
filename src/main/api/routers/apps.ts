import { TRPCError } from "@trpc/server";
import { asc, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { searchApps } from "@main/apple/itunes";
import { apps, appKeywords, keywords, trackedApps } from "@main/db/schema";
import { createTRPCRouter, publicProcedure } from "@main/api/trpc";
import { appIdInput, countryInput, folderIdInput } from "@main/api/inputs";
import { ensureApps, upsertApps } from "@main/services/apps";

/** Accepts "123", "id123" or a full apps.apple.com URL. */
function parseAppId(query: string): string | null {
  const match = query.trim().match(/(?:^|\/id|^id)(\d{6,})(?:\D|$)/);
  return match ? match[1] : null;
}

export const appsRouter = createTRPCRouter({
  /** Sidebar list of tracked apps with keyword counts for the active storefront. */
  tracked: publicProcedure.input(z.object({ country: countryInput })).query(async ({ ctx, input }) => {
    return ctx.db
      .select({
        id: apps.id,
        name: apps.name,
        developer: apps.developer,
        iconUrl: apps.iconUrl,
        genre: apps.genre,
        rating: apps.rating,
        ratingCount: apps.ratingCount,
        folderId: trackedApps.folderId,
        createdAt: trackedApps.createdAt,
        keywordCount: sql<number>`(
          select count(*) from ${appKeywords}
          join ${keywords} on ${keywords.id} = ${appKeywords.keywordId}
          where ${appKeywords.appId} = ${apps.id} and ${keywords.country} = ${input.country}
        )`,
      })
      .from(trackedApps)
      .innerJoin(apps, eq(apps.id, trackedApps.appId))
      .orderBy(asc(trackedApps.sortOrder), asc(trackedApps.createdAt));
  }),

  search: publicProcedure
    .input(z.object({ query: z.string().trim().min(1).max(200), country: countryInput }))
    .query(async ({ input }) => {
      const id = parseAppId(input.query);
      if (id) {
        const found = await ensureApps([id], input.country, { requireFull: true });
        const app = found.get(id);
        return app ? [app] : [];
      }
      const results = await searchApps(input.query, input.country);
      await upsertApps(results, input.country);
      return results;
    }),

  get: publicProcedure
    .input(z.object({ id: appIdInput, country: countryInput }))
    .query(async ({ ctx, input }) => {
      const app = (await ensureApps([input.id], input.country, { requireFull: true })).get(input.id);
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "App not found in this storefront" });
      const [tracked] = await ctx.db
        .select({ n: count() })
        .from(trackedApps)
        .where(eq(trackedApps.appId, input.id));
      return { ...app, isTracked: tracked.n > 0 };
    }),

  track: publicProcedure
    .input(z.object({ id: appIdInput, country: countryInput, folderId: folderIdInput.optional() }))
    .mutation(async ({ ctx, input }) => {
      const app = (await ensureApps([input.id], input.country, { requireFull: true })).get(input.id);
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "App not found in this storefront" });
      const [{ max }] = await ctx.db
        .select({ max: sql<number>`coalesce(max(${trackedApps.sortOrder}), 0)` })
        .from(trackedApps);
      await ctx.db
        .insert(trackedApps)
        .values({ appId: input.id, folderId: input.folderId, defaultCountry: input.country, sortOrder: max + 1 })
        .onConflictDoNothing();
      return app;
    }),

  /** Moves a tracked app into a folder (or back to the top level with `null`), placing it last. */
  moveToFolder: publicProcedure
    .input(z.object({ id: appIdInput, folderId: folderIdInput.nullable() }))
    .mutation(async ({ ctx, input }) => {
      const [{ max }] = await ctx.db
        .select({ max: sql<number>`coalesce(max(${trackedApps.sortOrder}), 0)` })
        .from(trackedApps);
      await ctx.db
        .update(trackedApps)
        .set({ folderId: input.folderId, sortOrder: max + 1 })
        .where(eq(trackedApps.appId, input.id));
    }),

  untrack: publicProcedure.input(z.object({ id: appIdInput })).mutation(async ({ ctx, input }) => {
    await ctx.db.delete(trackedApps).where(eq(trackedApps.appId, input.id));
  }),

  refresh: publicProcedure
    .input(z.object({ id: appIdInput, country: countryInput }))
    .mutation(async ({ input }) => {
      await ensureApps([input.id], input.country, { force: true });
    }),
});
