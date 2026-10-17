import { and, desc, eq, gte, inArray, min, sql } from "drizzle-orm";
import pLimit from "p-limit";
import { storeSearch } from "@main/apple/store-search";
import { db } from "@main/db";
import { appKeywords, keywords, keywordSnapshots, type Keyword } from "@main/db/schema";
import { ensureApps, getCachedApps, upsertApps } from "./apps";
import type { DailyPosition, Trend, TrendWindow } from "@shared/trends";
import { computeDifficulty, estimatePopularity } from "./scoring";
import {
  computeTrends,
  dailyPoints,
  dailySeries,
  localDay,
  positionHistory,
  startOfLocalDay,
  TREND_LOOKBACK_DAYS,
} from "./trends";

/** How long cached keyword data is fresh before it's refetched from Apple. */
export const KEYWORD_CACHE_TTL_MS = 24 * 3_600_000;
export const TOP_APPS_PREVIEW = 5;
const DIFFICULTY_SAMPLE = 10;

export function normalizeTerm(term: string) {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isStale(lastFetchedAt: Date | null) {
  if (!lastFetchedAt) return true;
  return Date.now() - lastFetchedAt.getTime() > KEYWORD_CACHE_TTL_MS;
}

/** Hit Apple for a keyword: ranking, popularity estimate and difficulty. */
async function fetchKeywordData(term: string, country: string) {
  const [search, popularity] = await Promise.all([
    storeSearch(term, country),
    estimatePopularity(term, country),
  ]);
  await upsertApps(search.apps, country);

  // Search lockups usually carry the top ~8 apps; only look up what's missing.
  const sample = search.rankedAppIds.slice(0, DIFFICULTY_SAMPLE);
  const known = await getCachedApps(sample);
  const appsById =
    sample.every((id) => known.has(id)) ? known : await ensureApps(sample, country).catch(() => known);
  const difficulty = computeDifficulty(
    sample.map((id) => appsById.get(id)),
    term,
  );

  return {
    popularity,
    difficulty,
    resultCount: search.rankedAppIds.length,
    rankedAppIds: search.rankedAppIds,
  };
}

const inflight = new Map<string, Promise<Keyword>>();

/**
 * Returns the cached keyword when it's fresh; otherwise fetches it from Apple,
 * stores the result and appends a history snapshot. Concurrent requests for the
 * same term/country share one fetch.
 */
export async function getOrFetchKeyword(
  rawTerm: string,
  country: string,
  { force = false }: { force?: boolean } = {},
): Promise<Keyword> {
  const term = normalizeTerm(rawTerm);
  const key = `${country}:${term}`;
  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const [existing] = await db
      .select()
      .from(keywords)
      .where(and(eq(keywords.term, term), eq(keywords.country, country)))
      .limit(1);
    if (existing && !force && !isStale(existing.lastFetchedAt)) return existing;

    const data = await fetchKeywordData(term, country);
    const now = new Date();
    const [row] = await db
      .insert(keywords)
      .values({ term, country, ...data, lastFetchedAt: now })
      .onConflictDoUpdate({
        target: [keywords.term, keywords.country],
        set: { ...data, lastFetchedAt: now },
      })
      .returning();
    await db.insert(keywordSnapshots).values({ keywordId: row.id, ...data, fetchedAt: now });
    return row;
  })().finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
}

/** Re-fetch keywords by id, bypassing the cache. */
export async function refreshKeywords(ids: number[]) {
  if (ids.length === 0) return { refreshed: 0, failed: 0 };
  const rows = await db.select().from(keywords).where(inArray(keywords.id, ids));
  const limit = pLimit(4);
  const results = await Promise.allSettled(
    rows.map((k) => limit(() => getOrFetchKeyword(k.term, k.country, { force: true }))),
  );
  return {
    refreshed: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
}

/** Fetch (or reuse cached) keywords and link them to a tracked app. */
export async function addKeywordsToApp(appId: string, country: string, terms: string[]) {
  const unique = [...new Set(terms.map(normalizeTerm).filter(Boolean))];
  const limit = pLimit(4);
  const results = await Promise.allSettled(
    unique.map((term) => limit(() => getOrFetchKeyword(term, country))),
  );

  const added = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (added.length > 0) {
    await db
      .insert(appKeywords)
      .values(added.map((k) => ({ appId, keywordId: k.id })))
      .onConflictDoNothing();
  }
  const failed = unique.filter((_, i) => results[i].status === "rejected");
  return { added: added.length, failed };
}

export type KeywordRow = {
  id: number;
  term: string;
  country: string;
  popularity: number | null;
  difficulty: number | null;
  resultCount: number | null;
  lastFetchedAt: Date | null;
  stale: boolean;
  notes: string | null;
  tracked: boolean;
  position: number | null;
  /** Position change over each window, so the page can switch windows without refetching. */
  trends: Record<TrendWindow, Trend>;
  /** Daily positions for the sparkline, oldest first. */
  history: DailyPosition[];
  topApps: { id: string; name: string; iconUrl: string | null }[];
};

type BaseKeyword = Pick<
  Keyword,
  "id" | "term" | "country" | "popularity" | "difficulty" | "resultCount" | "lastFetchedAt"
> & { rankedAppIds: string[]; notes?: string | null; tracked?: boolean };

/** 1-based position of `appId` in a snapshot, computed in SQL to avoid shipping the arrays. */
function snapshotPosition(appId: string) {
  return sql<number | null>`(
    select e.key + 1 from json_each(${keywordSnapshots.rankedAppIds}) e where e.value = ${appId} limit 1
  )`;
}

/** Decorate keywords with the given app's position, history and top-ranking apps. */
async function buildRows(appId: string, base: BaseKeyword[]): Promise<KeywordRow[]> {
  if (base.length === 0) return [];
  const ids = base.map((k) => k.id);

  const [snapshots, firsts] = await Promise.all([
    db
      .select({
        keywordId: keywordSnapshots.keywordId,
        at: keywordSnapshots.fetchedAt,
        position: snapshotPosition(appId),
      })
      .from(keywordSnapshots)
      .where(
        and(
          inArray(keywordSnapshots.keywordId, ids),
          gte(keywordSnapshots.fetchedAt, startOfLocalDay(new Date(), TREND_LOOKBACK_DAYS)),
        ),
      ),
    // A keyword younger than a window is compared with its first point, so we need its age.
    db
      .select({ keywordId: keywordSnapshots.keywordId, first: min(keywordSnapshots.fetchedAt) })
      .from(keywordSnapshots)
      .where(inArray(keywordSnapshots.keywordId, ids))
      .groupBy(keywordSnapshots.keywordId),
  ]);

  const snapshotsByKeyword = Map.groupBy(snapshots, (s) => s.keywordId);
  const firstDayByKeyword = new Map(firsts.map((f) => [f.keywordId, f.first ? localDay(f.first) : null]));

  const previewIds = base.flatMap((k) => k.rankedAppIds.slice(0, TOP_APPS_PREVIEW));
  const appsById = await getCachedApps(previewIds);

  return base.map((k) => {
    const days = dailyPoints(snapshotsByKeyword.get(k.id) ?? []);
    const index = k.rankedAppIds.indexOf(appId);
    const position = index >= 0 ? index + 1 : null;

    return {
      id: k.id,
      term: k.term,
      country: k.country,
      popularity: k.popularity,
      difficulty: k.difficulty,
      resultCount: k.resultCount,
      lastFetchedAt: k.lastFetchedAt,
      stale: isStale(k.lastFetchedAt),
      notes: k.notes ?? null,
      tracked: k.tracked ?? false,
      position,
      trends: computeTrends(days, firstDayByKeyword.get(k.id) ?? null),
      history: positionHistory(days),
      topApps: k.rankedAppIds.slice(0, TOP_APPS_PREVIEW).map((id) => {
        const app = appsById.get(id);
        return { id, name: app?.name ?? "Unknown app", iconUrl: app?.iconUrl ?? null };
      }),
    };
  });
}

const keywordColumns = {
  id: keywords.id,
  term: keywords.term,
  country: keywords.country,
  popularity: keywords.popularity,
  difficulty: keywords.difficulty,
  resultCount: keywords.resultCount,
  lastFetchedAt: keywords.lastFetchedAt,
  rankedAppIds: keywords.rankedAppIds,
};

/** Keywords a tracked app follows in one storefront. */
export async function listTrackedKeywords(appId: string, country: string) {
  const rows = await db
    .select({ ...keywordColumns, notes: appKeywords.notes })
    .from(appKeywords)
    .innerJoin(keywords, eq(appKeywords.keywordId, keywords.id))
    .where(and(eq(appKeywords.appId, appId), eq(keywords.country, country)))
    .orderBy(desc(keywords.popularity), keywords.term);
  return buildRows(
    appId,
    rows.map((r) => ({ ...r, tracked: true })),
  );
}

/**
 * Every cached keyword (from anyone's tracking or exploration) where the app shows
 * up in the results — this is how competitor keywords are discovered.
 */
export async function listRankedKeywords(appId: string, country: string) {
  const rows = await db
    .select({
      ...keywordColumns,
      tracked: sql<boolean>`exists (
        select 1 from ${appKeywords}
        where ${appKeywords.keywordId} = ${keywords.id} and ${appKeywords.appId} = ${appId}
      )`.mapWith(Boolean),
      notes: sql<string | null>`(
        select ${appKeywords.notes} from ${appKeywords}
        where ${appKeywords.keywordId} = ${keywords.id} and ${appKeywords.appId} = ${appId}
      )`,
    })
    .from(keywords)
    .where(
      and(
        eq(keywords.country, country),
        sql`exists (select 1 from json_each(${keywords.rankedAppIds}) where value = ${appId})`,
      ),
    )
    .orderBy(desc(keywords.popularity), keywords.term);
  return buildRows(appId, rows);
}

/** Full ranking for a keyword, filling in app metadata that isn't cached yet. */
export async function getKeywordRanking(keywordId: number, limit?: number) {
  const [keyword] = await db.select().from(keywords).where(eq(keywords.id, keywordId)).limit(1);
  if (!keyword) return null;
  const ids = limit ? keyword.rankedAppIds.slice(0, limit) : keyword.rankedAppIds;
  const appsById = await ensureApps(ids, keyword.country).catch(() => getCachedApps(ids));
  return {
    keyword,
    stale: isStale(keyword.lastFetchedAt),
    apps: ids.map((id, i) => {
      const app = appsById.get(id);
      return {
        position: i + 1,
        id,
        name: app?.name ?? `App ${id}`,
        subtitle: app?.subtitle || null,
        developer: app?.developer ?? "",
        iconUrl: app?.iconUrl ?? null,
        rating: app?.rating ?? null,
        ratingCount: app?.ratingCount ?? null,
        genre: app?.genre ?? null,
        formattedPrice: app?.formattedPrice ?? null,
        storeUrl: app?.storeUrl ?? null,
        releaseDate: app?.releaseDate ?? null,
        titleMatch: app?.name.toLowerCase().includes(keyword.term) ?? false,
      };
    }),
  };
}

/** How many days the ranking dialog's history covers. */
const KEYWORD_HISTORY_DAYS = 90;

/** Daily popularity/difficulty/position for one keyword (and app), oldest first, null on gap days. */
export async function getKeywordHistory(keywordId: number, appId: string | null) {
  const rows = await db
    .select({
      at: keywordSnapshots.fetchedAt,
      popularity: keywordSnapshots.popularity,
      difficulty: keywordSnapshots.difficulty,
      position: appId ? snapshotPosition(appId) : sql<number | null>`null`,
    })
    .from(keywordSnapshots)
    .where(
      and(
        eq(keywordSnapshots.keywordId, keywordId),
        gte(keywordSnapshots.fetchedAt, startOfLocalDay(new Date(), KEYWORD_HISTORY_DAYS - 1)),
      ),
    );
  return dailySeries(dailyPoints(rows), KEYWORD_HISTORY_DAYS).map(
    (d) => d && { at: d.at, popularity: d.popularity, difficulty: d.difficulty, position: d.position },
  );
}
