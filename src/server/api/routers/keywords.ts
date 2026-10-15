import { TRPCError } from "@trpc/server";
import { and, eq, inArray, lt, or, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { appKeywords, keywords, trackedApps } from "@/server/db/schema";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { appIdInput, countryInput } from "@/server/api/inputs";
import { env } from "@/server/env";
import { getHints } from "@/server/services/hints";
import {
  addKeywordsToApp,
  getKeywordHistory,
  getKeywordRanking,
  getOrFetchKeyword,
  isStale,
  listRankedKeywords,
  listTrackedKeywords,
  normalizeTerm,
  refreshKeywords,
} from "@/server/services/keywords";
import { discoverKeywords, suggestKeywords } from "@/server/services/suggestions";

const termInput = z.string().trim().min(1).max(100);

export const keywordsRouter = createTRPCRouter({
  /** Keywords the app tracks (default) or every cached keyword it ranks for. */
  list: publicProcedure
    .input(
      z.object({
        appId: appIdInput,
        country: countryInput,
        scope: z.enum(["tracked", "ranked"]).default("tracked"),
      }),
    )
    .query(({ input }) =>
      input.scope === "tracked"
        ? listTrackedKeywords(input.appId, input.country)
        : listRankedKeywords(input.appId, input.country),
    ),

  add: publicProcedure
    .input(z.object({ appId: appIdInput, country: countryInput, terms: z.array(termInput).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const [tracked] = await ctx.db
        .select()
        .from(trackedApps)
        .where(eq(trackedApps.appId, input.appId))
        .limit(1);
      if (!tracked) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Add this app to My Apps first." });
      }
      return addKeywordsToApp(input.appId, input.country, input.terms);
    }),

  remove: publicProcedure
    .input(z.object({ appId: appIdInput, keywordIds: z.array(z.number().int()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(appKeywords)
        .where(and(eq(appKeywords.appId, input.appId), inArray(appKeywords.keywordId, input.keywordIds)));
    }),

  /** Force-refetch specific keywords from Apple, ignoring the cache. */
  refresh: publicProcedure
    .input(z.object({ keywordIds: z.array(z.number().int()).min(1).max(200) }))
    .mutation(({ input }) => refreshKeywords(input.keywordIds)),

  /** Refresh an app's keywords in a storefront (only stale ones unless `all`). */
  refreshApp: publicProcedure
    .input(z.object({ appId: appIdInput, country: countryInput, all: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const cutoff = new Date(Date.now() - env.KEYWORD_CACHE_TTL_HOURS * 3_600_000);
      const rows = await ctx.db
        .select({ id: keywords.id })
        .from(appKeywords)
        .innerJoin(keywords, eq(keywords.id, appKeywords.keywordId))
        .where(
          and(
            eq(appKeywords.appId, input.appId),
            eq(keywords.country, input.country),
            input.all ? undefined : or(isNull(keywords.lastFetchedAt), lt(keywords.lastFetchedAt, cutoff)),
          ),
        );
      return refreshKeywords(rows.map((r) => r.id));
    }),

  updateNotes: publicProcedure
    .input(z.object({ appId: appIdInput, keywordId: z.number().int(), notes: z.string().max(500) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(appKeywords)
        .set({ notes: input.notes.trim() || null })
        .where(and(eq(appKeywords.appId, input.appId), eq(appKeywords.keywordId, input.keywordId)));
    }),

  ranking: publicProcedure
    .input(z.object({ keywordId: z.number().int(), limit: z.number().int().min(1).max(300).optional() }))
    .query(async ({ input }) => {
      const ranking = await getKeywordRanking(input.keywordId, input.limit);
      if (!ranking) throw new TRPCError({ code: "NOT_FOUND", message: "Keyword not found" });
      return ranking;
    }),

  history: publicProcedure
    .input(z.object({ keywordId: z.number().int(), appId: appIdInput.nullable() }))
    .query(({ input }) => getKeywordHistory(input.keywordId, input.appId)),

  /** Look up any keyword without tracking it (served from cache when fresh). */
  explore: publicProcedure
    .input(z.object({ term: termInput, country: countryInput }))
    .query(async ({ input }) => {
      const keyword = await getOrFetchKeyword(input.term, input.country);
      return { ...keyword, stale: isStale(keyword.lastFetchedAt) };
    }),

  /** Recently explored/cached keywords for the explorer page. */
  recent: publicProcedure.input(z.object({ country: countryInput })).query(({ ctx, input }) =>
    ctx.db
      .select({
        id: keywords.id,
        term: keywords.term,
        popularity: keywords.popularity,
        difficulty: keywords.difficulty,
        resultCount: keywords.resultCount,
        lastFetchedAt: keywords.lastFetchedAt,
      })
      .from(keywords)
      .where(eq(keywords.country, input.country))
      .orderBy(sql`${keywords.lastFetchedAt} desc nulls last`)
      .limit(50),
  ),

  /** Live App Store autocomplete, used while typing keywords. */
  hints: publicProcedure
    .input(z.object({ term: z.string().max(100), country: countryInput }))
    .query(({ input }) => {
      const term = normalizeTerm(input.term);
      return term ? getHints(term, input.country) : [];
    }),

  /** Fetch likely keywords for any app so its rankings can be discovered. */
  discover: publicProcedure
    .input(z.object({ appId: appIdInput, country: countryInput }))
    .mutation(({ input }) => discoverKeywords(input.appId, input.country)),

  suggestions: publicProcedure
    .input(z.object({ appId: appIdInput, country: countryInput, seed: termInput.optional() }))
    .query(({ input }) => suggestKeywords(input.appId, input.country, input.seed)),
});
