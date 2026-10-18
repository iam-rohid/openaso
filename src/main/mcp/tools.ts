import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, eq } from "drizzle-orm";
import { app as electronApp } from "electron";
import pLimit from "p-limit";
import { z } from "zod";
import { createCaller } from "@main/api/root";
import { createTRPCContext, describeAppleError } from "@main/api/trpc";
import { AppleApiError } from "@main/apple/http";
import { db } from "@main/db";
import { keywords, type Keyword } from "@main/db/schema";
import { getCachedApps } from "@main/services/apps";
import { getOrFetchKeyword, isStale, normalizeTerm, TOP_APPS_PREVIEW } from "@main/services/keywords";
import { isTemporaryAppId, parseAppId } from "@shared/apps";
import { COUNTRY_CODES, DEFAULT_COUNTRY, type CountryCode } from "@shared/countries";
import { summarize } from "@shared/trend-summary";
import { DEFAULT_TREND_WINDOW, sparklineDays, TREND_WINDOWS, type DailyPosition, type Trend } from "@shared/trends";

/**
 * The tools agents see. They go through the same tRPC router as the UI (validation,
 * preconditions, Apple error messages) and reshape its output for agents: keywords by
 * term rather than id, apps by id, link or name, and compact JSON without UI-only fields.
 */

const INSTRUCTIONS = `OpenASO is a local App Store Optimization app. These tools read and research the user's tracked iOS apps and App Store keywords.

- Apps: pass a numeric App Store id, an apps.apple.com link, or the name of a tracked app (see list_apps). Use search_app_store to find other apps.
- Storefronts: "country" is a two-letter App Store code (US, GB, DE…). It defaults to the app's storefront, else US. Always tell the user which storefront the data is for.
- popularity (5–100) estimates how often a term is searched; difficulty (0–100) how hard it is to rank in its top results. Both are estimates from Apple's public data, not Apple's own numbers.
- position is the app's rank in search results (1 = first); null means it isn't in the ~250 results Apple returns.
- trend.delta is positive when the app moved up. trend.state "new"/"lost" means it entered or dropped out of the results.
- Keyword data is cached for 24 hours and refreshed daily for tracked keywords. Every uncached lookup costs requests against Apple's rate limit, so prefer cached data, look keywords up in batches with explore_keywords, and don't refresh what isn't stale.
- If Apple is rate limiting, wait a few minutes before trying again and work with the data you have.`;

// Created on first use: the router imports this module (via the server), so it isn't ready yet at load.
let caller: ReturnType<typeof createCaller>;

const appArg = z
  .string()
  .min(1)
  .describe("Numeric App Store id, apps.apple.com link, or the name of a tracked app");
const countryArg = z
  .string()
  .optional()
  .describe("Two-letter App Store storefront, like US or DE. Defaults to the app's storefront, else US");
const termArg = z.string().trim().min(1).max(100);
const windowArg = z
  .enum(TREND_WINDOWS)
  .default(DEFAULT_TREND_WINDOW)
  .describe("How far back position changes compare: 1d, 7d or 30d");

const READ = { readOnlyHint: true, openWorldHint: false } as const;
/** Looks things up from Apple; only the local cache changes. */
const RESEARCH = { readOnlyHint: true, openWorldHint: true } as const;

function errorMessage(err: unknown) {
  if (err instanceof AppleApiError) return describeAppleError(err).message;
  return err instanceof Error ? err.message : String(err);
}

/** Runs a tool, answering with compact JSON or a readable error. */
async function run(fn: () => Promise<unknown>) {
  try {
    return { content: [{ type: "text" as const, text: JSON.stringify(await fn()) }] };
  } catch (err) {
    return { isError: true, content: [{ type: "text" as const, text: errorMessage(err) }] };
  }
}

function toCountry(code: string | undefined, fallback: string = DEFAULT_COUNTRY): CountryCode {
  const upper = (code?.trim() || fallback).toUpperCase();
  const normalized = upper === "UK" ? "GB" : upper;
  if (!(COUNTRY_CODES as readonly string[]).includes(normalized)) {
    throw new Error(`Unknown storefront "${code}". Use one of: ${COUNTRY_CODES.join(", ")}.`);
  }
  return normalized as CountryCode;
}

type ResolvedApp = { id: string; name: string | null; tracked: boolean; country: CountryCode };

/** Finds an app by id, App Store link or tracked app name, with the storefront to use for it. */
async function resolveApp(ref: string, country?: string): Promise<ResolvedApp> {
  const tracked = await caller.apps.tracked();
  const trimmed = ref.trim();
  const id = parseAppId(trimmed) ?? (isTemporaryAppId(trimmed) ? trimmed : null);
  let match: (typeof tracked)[number] | undefined;
  if (id) {
    match = tracked.find((a) => a.id === id);
    if (!match) return { id, name: null, tracked: false, country: toCountry(country) };
  } else {
    const name = trimmed.toLowerCase();
    const exact = tracked.filter((a) => a.name.toLowerCase() === name);
    const matches = exact.length > 0 ? exact : tracked.filter((a) => a.name.toLowerCase().includes(name));
    if (matches.length === 0) {
      throw new Error(
        `No tracked app matches "${ref}". Use list_apps to see tracked apps, or search_app_store and pass the app's numeric id.`,
      );
    }
    if (matches.length > 1) {
      const names = matches.map((a) => `${a.name} (${a.id})`).join(", ");
      throw new Error(`"${ref}" matches several tracked apps: ${names}. Pass the id instead.`);
    }
    match = matches[0];
  }
  return { id: match.id, name: match.name, tracked: true, country: toCountry(country, match.country) };
}

const isoDate = (date: Date | null) => date?.toISOString() ?? null;

/** Names of the apps ranking first for each keyword. */
async function topAppNames(list: Pick<Keyword, "rankedAppIds">[]) {
  const appsById = await getCachedApps(list.flatMap((k) => k.rankedAppIds.slice(0, TOP_APPS_PREVIEW)));
  return (k: Pick<Keyword, "rankedAppIds">) =>
    k.rankedAppIds.slice(0, TOP_APPS_PREVIEW).map((id) => appsById.get(id)?.name ?? `App ${id}`);
}

const trendOf = (trend: Trend) => ({ state: trend.state, delta: trend.delta });

/** Daily positions: a number, "unranked", or null on days it wasn't checked. */
const positionsOf = (history: DailyPosition[]) =>
  history.map((point) => (point ? (point.position ?? "unranked") : null));

async function findKeyword(term: string, country: CountryCode) {
  const [row] = await db
    .select()
    .from(keywords)
    .where(and(eq(keywords.term, normalizeTerm(term)), eq(keywords.country, country)))
    .limit(1);
  return row;
}

function registerReadTools(server: McpServer) {
  server.registerTool(
    "list_apps",
    {
      title: "List tracked apps",
      description:
        "The apps the user tracks in OpenASO, with their storefront, folder and number of tracked keywords. Unreleased apps are placeholders for apps not on the App Store yet.",
      annotations: READ,
    },
    () =>
      run(async () => {
        const [apps, folders] = await Promise.all([caller.apps.tracked(), caller.folders.list()]);
        const folderNames = new Map(folders.map((f) => [f.id, f.name]));
        return apps.map((a) => ({
          id: a.id,
          name: a.name,
          developer: a.developer || null,
          genre: a.genre,
          rating: a.rating,
          ratingCount: a.ratingCount,
          unreleased: a.isTemporary,
          country: a.country,
          folder: a.folderId == null ? null : (folderNames.get(a.folderId) ?? null),
          keywords: a.keywordCount,
        }));
      }),
  );

  server.registerTool(
    "get_app",
    {
      title: "Get app details",
      description:
        "An app's App Store metadata: title, subtitle, description, developer, rating, price and version. Works for any app, tracked or not.",
      inputSchema: { app: appArg, country: countryArg },
      annotations: RESEARCH,
    },
    ({ app, country }) =>
      run(async () => {
        const resolved = await resolveApp(app, country);
        const a = await caller.apps.get({ id: resolved.id, country: resolved.country });
        return {
          id: a.id,
          name: a.name,
          subtitle: a.subtitle || null,
          developer: a.developer || null,
          genre: a.genre,
          price: a.formattedPrice,
          rating: a.rating,
          ratingCount: a.ratingCount,
          version: a.version,
          released: isoDate(a.releaseDate),
          updated: isoDate(a.updatedDate),
          url: a.storeUrl,
          unreleased: a.isTemporary,
          tracked: a.isTracked,
          country: a.storefront,
          description: a.description,
        };
      }),
  );

  server.registerTool(
    "get_app_keywords",
    {
      title: "Get an app's keywords",
      description:
        "Keywords for an app in one storefront with its position, trend, popularity, difficulty and top-ranking apps. scope \"tracked\" lists the keywords the user tracks for a tracked app; \"ranked\" lists every keyword in OpenASO's cache the app ranks for, which works for competitors too (run discover_app_keywords first to find more).",
      inputSchema: {
        app: appArg,
        country: countryArg,
        scope: z.enum(["tracked", "ranked"]).default("tracked"),
        window: windowArg,
        includeHistory: z
          .boolean()
          .default(false)
          .describe("Add daily positions over the window (at least 7 days), oldest first"),
        limit: z.number().int().min(1).max(1000).default(200).describe("Most popular keywords first"),
      },
      annotations: READ,
    },
    ({ app, country, scope, window, includeHistory, limit }) =>
      run(async () => {
        const resolved = await resolveApp(app, country);
        const rows = await caller.keywords.list({ appId: resolved.id, country: resolved.country, scope });
        const days = sparklineDays(window);
        return {
          app: { id: resolved.id, name: resolved.name },
          country: resolved.country,
          scope,
          window,
          total: rows.length,
          keywords: rows.slice(0, limit).map((k) => ({
            term: k.term,
            position: k.position,
            trend: trendOf(k.trends[window]),
            popularity: k.popularity,
            difficulty: k.difficulty,
            results: k.resultCount,
            topApps: k.topApps.map((a) => a.name),
            ...(scope === "ranked" && { tracked: k.tracked }),
            ...(k.notes && { notes: k.notes }),
            updated: isoDate(k.lastFetchedAt),
            ...(includeHistory && { history: positionsOf(k.history.slice(-days)) }),
          })),
        };
      }),
  );

  server.registerTool(
    "get_ranking_summary",
    {
      title: "Get ranking summary",
      description:
        "How a tracked app's tracked keywords rank in one storefront: how many are in the top 10, top 50 and ranked at all, now and at the start of the window, plus the biggest gains and drops and the keywords that entered or left the results.",
      inputSchema: { app: appArg, country: countryArg, window: windowArg },
      annotations: READ,
    },
    ({ app, country, window }) =>
      run(async () => {
        const resolved = await resolveApp(app, country);
        const rows = await caller.keywords.list({ appId: resolved.id, country: resolved.country });
        const summary = summarize(
          rows.map((r) => ({ ...r, trend: r.trends[window] })),
          window,
        );
        const moved = (r: (typeof rows)[number] & { trend: Trend }) => ({
          term: r.term,
          position: r.position,
          delta: r.trend.delta,
          popularity: r.popularity,
        });
        return {
          app: { id: resolved.id, name: resolved.name },
          country: resolved.country,
          window,
          keywords: rows.length,
          now: summary.now ?? null,
          before: summary.before ?? null,
          gains: summary.gainers.slice(0, 10).map(moved),
          drops: summary.losers.slice(0, 10).map(moved),
          entered: summary.entered.map((r) => ({ term: r.term, position: r.position })),
          left: summary.dropped.map((r) => r.term),
        };
      }),
  );

  server.registerTool(
    "get_keyword_history",
    {
      title: "Get keyword history",
      description:
        "Daily popularity and difficulty for a keyword over the last 90 days, and an app's position on each day when an app is given. Only days the keyword was checked are listed.",
      inputSchema: {
        term: termArg,
        app: appArg.optional().describe("Include this app's daily position (id, link or tracked app name)"),
        country: countryArg,
      },
      annotations: READ,
    },
    ({ term, app, country }) =>
      run(async () => {
        const resolved = app ? await resolveApp(app, country) : null;
        const storefront = resolved?.country ?? toCountry(country);
        const keyword = await findKeyword(term, storefront);
        if (!keyword) {
          throw new Error(`"${term}" hasn't been looked up in ${storefront} yet, so it has no history. Use explore_keywords first.`);
        }
        const days = await caller.keywords.history({ keywordId: keyword.id, appId: resolved?.id ?? null });
        return {
          term: keyword.term,
          country: storefront,
          ...(resolved && { app: { id: resolved.id, name: resolved.name } }),
          days: days.flatMap((d) =>
            d
              ? [
                  {
                    date: d.at.toISOString().slice(0, 10),
                    popularity: d.popularity,
                    difficulty: d.difficulty,
                    ...(resolved && { position: d.position }),
                  },
                ]
              : [],
          ),
        };
      }),
  );
}

/** At most this many forced refetches per explore_keywords call, like the app's bulk refresh. */
const MAX_FORCED_REFRESH = 50;

function registerResearchTools(server: McpServer) {
  server.registerTool(
    "search_app_store",
    {
      title: "Search the App Store",
      description:
        "Searches the App Store for apps by name or term, or looks one up by numeric id or apps.apple.com link. Returns ids to pass to other tools.",
      inputSchema: {
        query: z.string().trim().min(1).max(200),
        country: countryArg,
        limit: z.number().int().min(1).max(50).default(10),
      },
      annotations: RESEARCH,
    },
    ({ query, country, limit }) =>
      run(async () => {
        const storefront = toCountry(country);
        const results = await caller.apps.search({ query, country: storefront });
        return {
          country: storefront,
          apps: results.slice(0, limit).map((a) => ({
            id: a.id,
            name: a.name,
            subtitle: a.subtitle || null,
            developer: a.developer || null,
            genre: a.genre,
            price: a.formattedPrice,
            rating: a.rating,
            ratingCount: a.ratingCount,
          })),
        };
      }),
  );

  server.registerTool(
    "explore_keywords",
    {
      title: "Explore keywords",
      description:
        "Looks up keywords without tracking them: popularity, difficulty, number of results and the top-ranking apps, plus an app's position when an app is given. Uses cached data less than 24 hours old; look up many terms in one call rather than one call per term.",
      inputSchema: {
        terms: z.array(termArg).min(1).max(50),
        country: countryArg,
        app: appArg.optional().describe("Include this app's position for each keyword"),
        refresh: z
          .boolean()
          .default(false)
          .describe("Refetch from Apple even when cached data is fresh. Costs rate limit; rarely needed"),
      },
      annotations: RESEARCH,
    },
    ({ terms, country, app, refresh }) =>
      run(async () => {
        const resolved = app ? await resolveApp(app, country) : null;
        const storefront = resolved?.country ?? toCountry(country);
        const unique = [...new Set(terms.map(normalizeTerm))];
        const limit = pLimit(4);
        const results = await Promise.allSettled(
          unique.map((term, i) =>
            limit(() => getOrFetchKeyword(term, storefront, { force: refresh && i < MAX_FORCED_REFRESH })),
          ),
        );
        const found = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
        const names = await topAppNames(found);
        const failed = unique.flatMap((term, i) => {
          const r = results[i];
          return r.status === "rejected" ? [{ term, error: errorMessage(r.reason) }] : [];
        });
        return {
          country: storefront,
          ...(resolved && { app: { id: resolved.id, name: resolved.name } }),
          keywords: found.map((k) => {
            const index = resolved ? k.rankedAppIds.indexOf(resolved.id) : -1;
            return {
              term: k.term,
              popularity: k.popularity,
              difficulty: k.difficulty,
              results: k.resultCount,
              ...(resolved && { position: index >= 0 ? index + 1 : null }),
              topApps: names(k),
              updated: isoDate(k.lastFetchedAt),
            };
          }),
          ...(failed.length > 0 && { failed }),
        };
      }),
  );

  server.registerTool(
    "get_keyword_ranking",
    {
      title: "Get keyword ranking",
      description:
        "The apps ranking for a keyword in App Store search, in order, with their subtitle, developer, rating and whether the keyword is in their title.",
      inputSchema: {
        term: termArg,
        country: countryArg,
        limit: z.number().int().min(1).max(250).default(25),
      },
      annotations: RESEARCH,
    },
    ({ term, country, limit }) =>
      run(async () => {
        const storefront = toCountry(country);
        const keyword = await getOrFetchKeyword(term, storefront);
        const ranking = await caller.keywords.ranking({ keywordId: keyword.id, limit });
        return {
          term: keyword.term,
          country: storefront,
          popularity: keyword.popularity,
          difficulty: keyword.difficulty,
          results: keyword.resultCount,
          updated: isoDate(keyword.lastFetchedAt),
          stale: isStale(keyword.lastFetchedAt),
          apps: ranking.apps.map((a) => ({
            position: a.position,
            id: a.id,
            name: a.name,
            subtitle: a.subtitle,
            developer: a.developer || null,
            genre: a.genre,
            rating: a.rating,
            ratingCount: a.ratingCount,
            price: a.formattedPrice,
            titleMatch: a.titleMatch,
          })),
        };
      }),
  );

  server.registerTool(
    "get_keyword_suggestions",
    {
      title: "Get keyword suggestions",
      description:
        "Keyword ideas for an app, each with an estimated popularity and where it came from: the app's title and description, App Store autocomplete, and phrases competitors use in their titles. Pass a seed keyword to get ideas around it instead. Keywords the app already tracks are left out.",
      inputSchema: { app: appArg, country: countryArg, seed: termArg.optional() },
      annotations: RESEARCH,
    },
    ({ app, country, seed }) =>
      run(async () => {
        const resolved = await resolveApp(app, country);
        const suggestions = await caller.keywords.suggestions({ appId: resolved.id, country: resolved.country, seed });
        return {
          app: { id: resolved.id, name: resolved.name },
          country: resolved.country,
          suggestions: suggestions.map((s) => ({ term: s.term, popularity: s.popularity, sources: s.sources })),
        };
      }),
  );

  server.registerTool(
    "get_autocomplete",
    {
      title: "Get App Store autocomplete",
      description: "What the App Store's search box suggests for a partial term, in its order.",
      inputSchema: { term: termArg, country: countryArg },
      annotations: RESEARCH,
    },
    ({ term, country }) =>
      run(async () => {
        const storefront = toCountry(country);
        return { country: storefront, suggestions: await caller.keywords.hints({ term, country: storefront }) };
      }),
  );

  server.registerTool(
    "discover_app_keywords",
    {
      title: "Discover an app's keywords",
      description:
        "Checks about 15 keywords an app (usually a competitor) is likely to rank for, then returns every cached keyword it ranks for, most popular first. Use it before get_app_keywords with scope \"ranked\" for an app OpenASO knows little about.",
      inputSchema: { app: appArg, country: countryArg, limit: z.number().int().min(1).max(500).default(50) },
      annotations: RESEARCH,
    },
    ({ app, country, limit }) =>
      run(async () => {
        const resolved = await resolveApp(app, country);
        const { checked } = await caller.keywords.discover({ appId: resolved.id, country: resolved.country });
        const rows = await caller.keywords.list({ appId: resolved.id, country: resolved.country, scope: "ranked" });
        return {
          app: { id: resolved.id, name: resolved.name },
          country: resolved.country,
          checked,
          ranked: rows.length,
          keywords: rows.slice(0, limit).map((k) => ({
            term: k.term,
            position: k.position,
            popularity: k.popularity,
            difficulty: k.difficulty,
            tracked: k.tracked,
          })),
        };
      }),
  );
}

export function createMcpServer() {
  caller ??= createCaller(createTRPCContext);
  const server = new McpServer(
    { name: "openaso", title: "OpenASO", version: electronApp.getVersion() },
    { instructions: INSTRUCTIONS },
  );
  registerReadTools(server);
  registerResearchTools(server);
  return server;
}
