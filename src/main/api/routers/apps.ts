import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { searchApps } from "@main/apple/itunes";
import { apps, appKeywords, keywords, trackedApps } from "@main/db/schema";
import { createTRPCRouter, publicProcedure } from "@main/api/trpc";
import { appIdInput, countryInput, folderIdInput } from "@main/api/inputs";
import { ensureApps, upsertApps } from "@main/services/apps";
import { DEFAULT_COUNTRY, type CountryCode } from "@shared/countries";
import { isTemporaryAppId, TEMPORARY_APP_NAME_MAX, TEMPORARY_APP_PREFIX } from "@shared/apps";

const temporaryNameInput = z.string().trim().min(1).max(TEMPORARY_APP_NAME_MAX);
const temporaryAppIdInput = appIdInput.refine(isTemporaryAppId, "Not a temporary app");

/** Accepts "123", "id123" or a full apps.apple.com URL. */
function parseAppId(query: string): string | null {
  const match = query.trim().match(/(?:^|\/id|^id)(\d{6,})(?:\D|$)/);
  return match ? match[1] : null;
}

export const appsRouter = createTRPCRouter({
  /** Sidebar list of tracked apps, each with its storefront and keyword count there. */
  tracked: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: apps.id,
        name: apps.name,
        developer: apps.developer,
        iconUrl: apps.iconUrl,
        genre: apps.genre,
        rating: apps.rating,
        ratingCount: apps.ratingCount,
        isTemporary: apps.isTemporary,
        country: trackedApps.defaultCountry,
        folderId: trackedApps.folderId,
        createdAt: trackedApps.createdAt,
        keywordCount: sql<number>`(
          select count(*) from ${appKeywords}
          join ${keywords} on ${keywords.id} = ${appKeywords.keywordId}
          where ${appKeywords.appId} = ${apps.id} and ${keywords.country} = ${trackedApps.defaultCountry}
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

  /** An app in its own storefront (or `country`, for apps that aren't tracked). */
  get: publicProcedure
    .input(z.object({ id: appIdInput, country: countryInput.optional() }))
    .query(async ({ ctx, input }) => {
      const [tracked] = await ctx.db
        .select({ country: trackedApps.defaultCountry })
        .from(trackedApps)
        .where(eq(trackedApps.appId, input.id));
      const storefront = (tracked?.country ?? input.country ?? DEFAULT_COUNTRY) as CountryCode;
      const app = (await ensureApps([input.id], storefront, { requireFull: true })).get(input.id);
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "App not found in this storefront" });
      return { ...app, isTracked: !!tracked, storefront };
    }),

  /** Switches the storefront a tracked app is viewed in. */
  setCountry: publicProcedure
    .input(z.object({ id: appIdInput, country: countryInput }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(trackedApps)
        .set({ defaultCountry: input.country })
        .where(eq(trackedApps.appId, input.id));
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

  /** Creates and tracks a placeholder for an app that isn't on the App Store yet. */
  createTemporary: publicProcedure
    .input(z.object({ name: temporaryNameInput, country: countryInput, folderId: folderIdInput.optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction((tx) => {
        const app = tx
          .insert(apps)
          .values({
            id: `${TEMPORARY_APP_PREFIX}${randomUUID().replaceAll("-", "")}`,
            name: input.name,
            subtitle: "",
            country: input.country,
            isTemporary: true,
          })
          .returning()
          .get();
        const { max } = tx
          .select({ max: sql<number>`coalesce(max(${trackedApps.sortOrder}), 0)` })
          .from(trackedApps)
          .get()!;
        tx.insert(trackedApps)
          .values({ appId: app.id, folderId: input.folderId, defaultCountry: input.country, sortOrder: max + 1 })
          .run();
        return app;
      });
    }),

  renameTemporary: publicProcedure
    .input(z.object({ id: temporaryAppIdInput, name: temporaryNameInput }))
    .mutation(async ({ ctx, input }) => {
      const [app] = await ctx.db
        .update(apps)
        .set({ name: input.name })
        .where(and(eq(apps.id, input.id), eq(apps.isTemporary, true)))
        .returning();
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "App not found" });
      return app;
    }),

  /**
   * Replaces a temporary app with its real App Store listing: its keywords and notes
   * move to the real app (merging if that's already tracked) and the placeholder is deleted.
   */
  linkTemporary: publicProcedure
    .input(z.object({ id: temporaryAppIdInput, targetId: appIdInput, country: countryInput }))
    .mutation(async ({ ctx, input }) => {
      if (isTemporaryAppId(input.targetId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Pick an App Store app to link to" });
      }
      const target = (await ensureApps([input.targetId], input.country, { requireFull: true })).get(input.targetId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "App not found in this storefront" });

      return ctx.db.transaction((tx) => {
        const placeholder = tx.select().from(trackedApps).where(eq(trackedApps.appId, input.id)).get();
        if (!placeholder) throw new TRPCError({ code: "NOT_FOUND", message: "App not found" });

        // An already tracked target keeps its own folder and position.
        const merged = !!tx.select().from(trackedApps).where(eq(trackedApps.appId, target.id)).get();
        if (!merged) {
          tx.insert(trackedApps)
            .values({
              appId: target.id,
              folderId: placeholder.folderId,
              defaultCountry: placeholder.defaultCountry,
              sortOrder: placeholder.sortOrder,
            })
            .run();
        }

        const { moved } = tx
          .select({ moved: count() })
          .from(appKeywords)
          .where(eq(appKeywords.appId, input.id))
          .get()!;
        // Keywords both apps follow keep the real app's note unless it's empty.
        tx.run(sql`
          insert into ${appKeywords} (app_id, keyword_id, notes, created_at)
          select ${target.id}, keyword_id, notes, created_at from ${appKeywords} where app_id = ${input.id}
          on conflict (app_id, keyword_id) do update
          set notes = coalesce(nullif(${appKeywords.notes}, ''), excluded.notes)
        `);
        // Cascades to the placeholder's tracked row and keyword links.
        tx.delete(apps).where(eq(apps.id, input.id)).run();
        return { app: target, moved, merged };
      });
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
    // Temporary apps can't be found again once untracked, so drop the app itself.
    if (isTemporaryAppId(input.id)) await ctx.db.delete(apps).where(eq(apps.id, input.id));
    else await ctx.db.delete(trackedApps).where(eq(trackedApps.appId, input.id));
  }),

  refresh: publicProcedure
    .input(z.object({ id: appIdInput, country: countryInput }))
    .mutation(async ({ input }) => {
      await ensureApps([input.id], input.country, { force: true });
    }),
});
