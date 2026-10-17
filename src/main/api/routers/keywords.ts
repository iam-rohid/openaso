import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TRPCError } from "@trpc/server";
import { app, BrowserWindow, dialog } from "electron";
import { and, eq, inArray, lt, or, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { appKeywords, keywords, trackedApps } from "@main/db/schema";
import { createTRPCRouter, publicProcedure } from "@main/api/trpc";
import { appIdInput, countryInput } from "@main/api/inputs";
import { getHints } from "@main/services/hints";
import { exportKeywordsCsv, importKeywords, KeywordCsvError, readImportRows } from "@main/services/keyword-csv";
import {
  addKeywordsToApp,
  getKeywordHistory,
  getKeywordRanking,
  getOrFetchKeyword,
  isStale,
  KEYWORD_CACHE_TTL_MS,
  listRankedKeywords,
  listTrackedKeywords,
  normalizeTerm,
  refreshKeywords,
} from "@main/services/keywords";
import { discoverKeywords, suggestKeywords } from "@main/services/suggestions";
import { TREND_WINDOWS } from "@shared/trends";

const termInput = z.string().trim().min(1).max(100);
/** Most keywords one refresh request takes; also caps the refresh started by an import. */
const MAX_REFRESH = 1000;

/** Native file dialogs attach to the window that asked, so they open as sheets on macOS. */
const dialogWindow = () => BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];

const fileName = (name: string) => name.replace(/[/\\:*?"<>|]/g, "-").trim();

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
    .input(z.object({ keywordIds: z.array(z.number().int()).min(1).max(MAX_REFRESH) }))
    .mutation(({ input }) => refreshKeywords(input.keywordIds)),

  /** Refresh an app's keywords in a storefront (only stale ones unless `all`). */
  refreshApp: publicProcedure
    .input(z.object({ appId: appIdInput, country: countryInput, all: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const cutoff = new Date(Date.now() - KEYWORD_CACHE_TTL_MS);
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

  /** Saves the app's keywords in one storefront as an Astro-compatible CSV, via a save dialog. */
  exportCsv: publicProcedure
    .input(z.object({ appId: appIdInput, country: countryInput, window: z.enum(TREND_WINDOWS) }))
    .mutation(async ({ input }) => {
      const { csv, appName, count } = await exportKeywordsCsv(input.appId, input.country, input.window);
      const options = {
        title: "Export Keywords",
        defaultPath: join(app.getPath("downloads"), fileName(`${appName} - ${input.country} Keywords.csv`)),
        filters: [{ name: "CSV", extensions: ["csv"] }],
      };
      const win = dialogWindow();
      const result = await (win ? dialog.showSaveDialog(win, options) : dialog.showSaveDialog(options));
      if (result.canceled || !result.filePath) return { canceled: true as const };
      await writeFile(result.filePath, csv, "utf8");
      return { canceled: false as const, count };
    }),

  /**
   * Imports keywords from a CSV (Astro's export or any file with a Keyword column), via an open
   * dialog. Rows go to the storefront in their Store Domain column, else `fallbackCountry`.
   */
  importCsv: publicProcedure
    .input(z.object({ appId: appIdInput, fallbackCountry: countryInput }))
    .mutation(async ({ ctx, input }) => {
      const [tracked] = await ctx.db
        .select()
        .from(trackedApps)
        .where(eq(trackedApps.appId, input.appId))
        .limit(1);
      if (!tracked) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Add this app to My Apps first." });
      }

      const options = {
        title: "Import Keywords",
        properties: ["openFile" as const],
        filters: [{ name: "CSV", extensions: ["csv"] }],
      };
      const win = dialogWindow();
      const result = await (win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options));
      const [filePath] = result.filePaths;
      if (result.canceled || !filePath) return { canceled: true as const };

      try {
        const { rows, skipped } = readImportRows(await readFile(filePath, "utf8"), input.fallbackCountry);
        const { newKeywordIds, ...imported } = importKeywords(input.appId, rows);
        // Anything past the cap stays outdated until the user refreshes it.
        return { canceled: false as const, skipped, ...imported, refreshIds: newKeywordIds.slice(0, MAX_REFRESH) };
      } catch (err) {
        if (err instanceof KeywordCsvError) throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        throw err;
      }
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
