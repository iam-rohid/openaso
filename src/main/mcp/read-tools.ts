import pLimit from "p-limit";
import { z } from "zod";
import { getCachedApps } from "@main/services/apps";
import { getOrFetchKeyword, isStale, normalizeTerm, TOP_APPS_PREVIEW } from "@main/services/keywords";
import type { Keyword } from "@main/db/schema";
import { summarize } from "@shared/trend-summary";
import { sparklineDays, type DailyPosition, type Trend } from "@shared/trends";
import {
  appArg,
  caller,
  countryArg,
  errorMessage,
  findKeyword,
  isoDate,
  type McpServer,
  READ,
  RESEARCH,
  resolveApp,
  run,
  termArg,
  toCountry,
  windowArg,
} from "./common";

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


export function registerReadTools(server: McpServer) {
  server.registerTool(
    "list_apps",
    {
      title: "List tracked apps",
      description:
        "The apps the user tracks in OpenASO, with their storefront, folder and number of tracked keywords, and the user's folders. Unreleased apps are placeholders for apps not on the App Store yet.",
      annotations: READ,
    },
    () =>
      run(async () => {
        const [apps, folders] = await Promise.all([caller.apps.tracked(), caller.folders.list()]);
        const folderNames = new Map(folders.map((f) => [f.id, f.name]));
        const tracked = apps.map((a) => ({
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
        return { apps: tracked, folders: folders.map((f) => f.name) };
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

export function registerResearchTools(server: McpServer) {
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

