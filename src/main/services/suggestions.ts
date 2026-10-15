import { and, desc, eq } from "drizzle-orm";
import pLimit from "p-limit";
import { db } from "@main/db";
import { appKeywords, keywords } from "@main/db/schema";
import { ensureApps, getCachedApps } from "./apps";
import { getHints } from "./hints";
import { getOrFetchKeyword, normalizeTerm } from "./keywords";
import { estimatePopularity } from "./scoring";

const STOPWORDS = new Set(
  `a an and are as at be by for from has have in is it its of on or that the this to was were will with
  your you our we my me i app apps new free best top get all more can just now one pro plus lite
  de la le les el los des du en et y para por con un une`.split(/\s+/),
);

const MAX_CANDIDATES = 40;

export type Suggestion = {
  term: string;
  popularity: number;
  score: number;
  sources: SuggestionSource[];
};
export type SuggestionSource = "title" | "autocomplete" | "competitors" | "description" | "seed";

/** 1–3 word phrases that don't start or end with a stopword. */
function ngrams(text: string, maxN = 3): string[] {
  const out: string[] = [];
  for (const segment of text.toLowerCase().split(/[-–—:|,.&!?()/+•]+/)) {
    const words = segment
      .replace(/[^\p{L}\p{N}' ]+/gu, " ")
      .split(/\s+/)
      .filter(Boolean);
    for (let n = 1; n <= maxN; n++) {
      for (let i = 0; i + n <= words.length; i++) {
        const gram = words.slice(i, i + n);
        if (STOPWORDS.has(gram[0]) || STOPWORDS.has(gram[n - 1])) continue;
        if (n === 1 && gram[0].length < 3) continue;
        out.push(gram.join(" "));
      }
    }
  }
  return out;
}

class CandidatePool {
  private map = new Map<string, { score: number; sources: Set<SuggestionSource> }>();
  constructor(private exclude: Set<string>) {}

  add(raw: string, score: number, source: SuggestionSource) {
    const term = normalizeTerm(raw);
    if (term.length < 2 || term.length > 40 || this.exclude.has(term)) return;
    if (/^\d+$/.test(term)) return;
    const entry = this.map.get(term) ?? { score: 0, sources: new Set() };
    entry.score += score;
    entry.sources.add(source);
    this.map.set(term, entry);
  }

  top(n: number) {
    return [...this.map.entries()]
      .map(([term, v]) => ({ term, score: v.score + v.sources.size, sources: [...v.sources] }))
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  }
}

/**
 * Keyword ideas for an app (optionally seeded with a keyword). Candidates come from
 * the app's own title/description, App Store autocomplete, and the titles of
 * competitors ranking for the app's keywords. Each is then scored for popularity.
 */
export async function suggestKeywords(
  appId: string,
  country: string,
  seed?: string,
): Promise<Suggestion[]> {
  const app = (await ensureApps([appId], country, { requireFull: true })).get(appId);

  const tracked = await db
    .select({ term: keywords.term, popularity: keywords.popularity, rankedAppIds: keywords.rankedAppIds })
    .from(appKeywords)
    .innerJoin(keywords, eq(appKeywords.keywordId, keywords.id))
    .where(and(eq(appKeywords.appId, appId), eq(keywords.country, country)))
    .orderBy(desc(keywords.popularity));

  const pool = new CandidatePool(new Set(tracked.map((k) => k.term)));
  const limit = pLimit(6);

  // 1. Title & description phrases.
  if (app && !seed) {
    for (const gram of ngrams(app.name)) pool.add(gram, 3, "title");
    if (app.description) {
      const counts = new Map<string, number>();
      for (const gram of ngrams(app.description.slice(0, 4000), 2)) {
        if (gram.includes(" ")) counts.set(gram, (counts.get(gram) ?? 0) + 1);
      }
      for (const [gram, count] of counts) if (count >= 2) pool.add(gram, Math.min(count, 4), "description");
    }
  }

  // 2. Autocomplete expansions of the seed / tracked keywords / title words.
  const seedTerm = seed ? normalizeTerm(seed) : undefined;
  if (seedTerm) pool.add(seedTerm, 5, "seed");
  const prefixes = seedTerm
    ? [seedTerm, `${seedTerm} `, ...seedTerm.split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w))]
    : [
        ...tracked.slice(0, 8).map((k) => k.term),
        ...(app ? ngrams(app.name, 2).filter((g) => g.includes(" ")).slice(0, 4) : []),
      ];
  const hintLists = await Promise.all(
    [...new Set(prefixes)].map((p) => limit(() => getHints(p, country).catch(() => []))),
  );
  [...new Set(prefixes)].forEach((prefix, n) => {
    const prefixWords = prefix.trim().split(" ");
    hintLists[n].forEach((hint, i) => {
      // Keep expansions that contain the prefix as whole words ("red" → "red flag",
      // not "reddit"), and skip "Brand: tagline" style app names.
      const words = hint.split(" ");
      const related = prefixWords.every((w) => words.includes(w));
      if (related && !hint.includes(":")) pool.add(hint, 3 - i * 0.2, "autocomplete");
    });
  });

  // 3. Phrases competitors put in their titles.
  const rankingSources = seedTerm
    ? (
        await db
          .select({ rankedAppIds: keywords.rankedAppIds })
          .from(keywords)
          .where(and(eq(keywords.term, seedTerm), eq(keywords.country, country)))
          .limit(1)
      ).map((k) => k.rankedAppIds)
    : tracked.slice(0, 6).map((k) => k.rankedAppIds);
  const competitorIds = [...new Set(rankingSources.flatMap((ids) => ids.slice(0, 10)))].filter(
    (id) => id !== appId,
  );
  if (competitorIds.length > 0) {
    const competitors = await getCachedApps(competitorIds);
    const counts = new Map<string, number>();
    for (const c of competitors.values()) {
      for (const gram of new Set(ngrams(c.name, 2))) counts.set(gram, (counts.get(gram) ?? 0) + 1);
    }
    for (const [gram, count] of counts) if (count >= 2) pool.add(gram, count * 1.5, "competitors");
  }

  const candidates = pool.top(MAX_CANDIDATES);
  const scored = await Promise.all(
    candidates.map((c) =>
      limit(async () => ({
        ...c,
        popularity: await estimatePopularity(c.term, country).catch(() => 5),
      })),
    ),
  );
  // Blend search popularity with how strongly the term relates to the app.
  const rank = (s: { popularity: number; score: number }) =>
    s.popularity * (0.5 + 0.5 * Math.min(1, s.score / 8));
  return scored.sort((a, b) => rank(b) - rank(a));
}

const DISCOVER_LIMIT = 15;

/**
 * Seeds the local keyword cache with likely keywords for an app (typically a
 * competitor) so its rankings show up in the "ranked keywords" view.
 */
export async function discoverKeywords(appId: string, country: string) {
  const candidates = (await suggestKeywords(appId, country)).slice(0, DISCOVER_LIMIT);
  const limit = pLimit(4);
  const results = await Promise.allSettled(
    candidates.map((c) => limit(() => getOrFetchKeyword(c.term, country))),
  );
  const fetched = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  return {
    checked: fetched.length,
    ranked: fetched.filter((k) => k.rankedAppIds.includes(appId)).length,
  };
}
