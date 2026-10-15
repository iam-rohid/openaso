import "server-only";
import { and, eq } from "drizzle-orm";
import { fetchSearchHints } from "@/server/apple/hints";
import { db } from "@/server/db";
import { searchHints } from "@/server/db/schema";

/** Autocomplete hints change slowly, so a few days of caching is plenty. */
const HINT_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const inflight = new Map<string, Promise<string[]>>();

export async function getHints(prefix: string, country: string): Promise<string[]> {
  const key = `${country}:${prefix}`;
  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const [cached] = await db
      .select()
      .from(searchHints)
      .where(and(eq(searchHints.prefix, prefix), eq(searchHints.country, country)))
      .limit(1);
    if (cached && Date.now() - cached.fetchedAt.getTime() < HINT_TTL_MS) return cached.hints;

    const hints = await fetchSearchHints(prefix, country);
    await db
      .insert(searchHints)
      .values({ prefix, country, hints })
      .onConflictDoUpdate({
        target: [searchHints.prefix, searchHints.country],
        set: { hints, fetchedAt: new Date() },
      });
    return hints;
  })().finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
}
