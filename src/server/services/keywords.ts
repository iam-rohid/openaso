import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import pLimit from "p-limit";
import { storeSearch } from "@/server/apple/store-search";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { appKeywords, keywords, keywordSnapshots, type Keyword } from "@/server/db/schema";
import { ensureApps, getCachedApps, upsertApps } from "./apps";
import { computeDifficulty, estimatePopularity } from "./scoring";

export const TOP_APPS_PREVIEW = 5;
const HISTORY_POINTS = 30;
const DIFFICULTY_SAMPLE = 10;

export function normalizeTerm(term: string) {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isStale(lastFetchedAt: Date | null) {
  if (!lastFetchedAt) return true;
  return Date.now() - lastFetchedAt.getTime() > env.KEYWORD_CACHE_TTL_HOURS * 3_600_000;
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
  /** Position change since the previous snapshot; positive = moved up. */
  positionChange: number | null;
  history: { at: Date; position: number | null; popularity: number | null }[];
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

  const snapshots = await db
    .select({
      keywordId: keywordSnapshots.keywordId,
      at: keywordSnapshots.fetchedAt,
      popularity: keywordSnapshots.popularity,
      position: snapshotPosition(appId),
    })
    .from(keywordSnapshots)
    .where(inArray(keywordSnapshots.keywordId, ids))
    .orderBy(desc(keywordSnapshots.fetchedAt));

  const historyByKeyword = new Map<number, KeywordRow["history"]>();
  for (const s of snapshots) {
    const list = historyByKeyword.get(s.keywordId) ?? [];
    if (list.length < HISTORY_POINTS) list.push({ at: s.at, position: s.position, popularity: s.popularity });
    historyByKeyword.set(s.keywordId, list);
  }

  const previewIds = base.flatMap((k) => k.rankedAppIds.slice(0, TOP_APPS_PREVIEW));
  const appsById = await getCachedApps(previewIds);

  return base.map((k) => {
    const history = (historyByKeyword.get(k.id) ?? []).reverse();
    const index = k.rankedAppIds.indexOf(appId);
    const position = index >= 0 ? index + 1 : null;
    const previous = history.length > 1 ? history[history.length - 2].position : undefined;
    let positionChange: number | null = null;
    if (previous !== undefined) {
      // Entering the ranking counts as a climb from just below the last result.
      const prev = previous ?? (k.resultCount ?? 250) + 1;
      const curr = position ?? (k.resultCount ?? 250) + 1;
      positionChange = position === null && previous === null ? 0 : prev - curr;
    }

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
      positionChange,
      history,
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

/** Popularity/position history for a single keyword and app. */
export async function getKeywordHistory(keywordId: number, appId: string | null) {
  return db
    .select({
      at: keywordSnapshots.fetchedAt,
      popularity: keywordSnapshots.popularity,
      difficulty: keywordSnapshots.difficulty,
      resultCount: keywordSnapshots.resultCount,
      position: appId ? snapshotPosition(appId) : sql<number | null>`null`,
    })
    .from(keywordSnapshots)
    .where(eq(keywordSnapshots.keywordId, keywordId))
    .orderBy(keywordSnapshots.fetchedAt);
}
