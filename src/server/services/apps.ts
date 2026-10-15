import "server-only";
import { inArray, sql } from "drizzle-orm";
import { lookupApps } from "@/server/apple/itunes";
import type { AppleApp } from "@/server/apple/types";
import { db } from "@/server/db";
import { apps, type App } from "@/server/db/schema";

/** App metadata (ratings, icon) refreshes weekly unless explicitly requested. */
const APP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Upsert app metadata. Partial sources (e.g. search lockups have no description)
 * never overwrite richer data already in the cache.
 */
export async function upsertApps(list: AppleApp[], country: string) {
  if (list.length === 0) return;
  const unique = [...new Map(list.map((a) => [a.id, a])).values()];
  const keep = (col: string) => sql.raw(`coalesce(excluded.${col}, apps.${col})`);

  await db
    .insert(apps)
    .values(unique.map((a) => ({ ...a, country, fetchedAt: new Date() })))
    .onConflictDoUpdate({
      target: apps.id,
      set: {
        name: sql`excluded.name`,
        developer: sql`excluded.developer`,
        developerId: keep("developer_id"),
        bundleId: keep("bundle_id"),
        iconUrl: keep("icon_url"),
        genre: keep("genre"),
        price: keep("price"),
        formattedPrice: keep("formatted_price"),
        rating: keep("rating"),
        ratingCount: keep("rating_count"),
        description: keep("description"),
        storeUrl: keep("store_url"),
        releaseDate: keep("release_date"),
        updatedDate: keep("updated_date"),
        version: keep("version"),
        country: sql`excluded.country`,
        fetchedAt: sql`excluded.fetched_at`,
      },
    });
}

export async function getCachedApps(ids: string[]): Promise<Map<string, App>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(apps).where(inArray(apps.id, [...new Set(ids)]));
  return new Map(rows.map((r) => [r.id, r]));
}

/**
 * Returns metadata for the given ids, looking up any that are missing (or stale /
 * incomplete when `requireFull`) from the iTunes Lookup API first.
 */
export async function ensureApps(
  ids: string[],
  country: string,
  { requireFull = false, force = false }: { requireFull?: boolean; force?: boolean } = {},
): Promise<Map<string, App>> {
  const cached = await getCachedApps(ids);
  const now = Date.now();
  const missing = ids.filter((id) => {
    const app = cached.get(id);
    if (!app || force) return true;
    // Ratings differ per storefront, so full views refetch when the storefront changes.
    if (requireFull && (!app.description || app.country !== country)) return true;
    return now - app.fetchedAt.getTime() > APP_TTL_MS;
  });

  if (missing.length > 0) {
    try {
      await upsertApps(await lookupApps(missing, country), country);
    } catch (err) {
      // Serving slightly stale metadata beats failing the whole request.
      if (missing.every((id) => cached.has(id))) return cached;
      throw err;
    }
    return getCachedApps(ids);
  }
  return cached;
}
