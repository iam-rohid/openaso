import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { FolderColor } from "../../lib/folders";

/** Timestamps are stored as epoch milliseconds and read back as Dates. */
const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });
const createdAt = (name: string) => timestamp(name).notNull().$defaultFn(() => new Date());
/** JSON arrays are stored as text; query them with SQLite's json_each. */
const jsonArray = (name: string) => text(name, { mode: "json" }).$type<string[]>();

/**
 * Cached App Store metadata. Keyed by Apple's numeric track id (stored as text).
 * Rating figures are taken from the storefront the app was last fetched in.
 */
export const apps = sqliteTable("apps", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** App Store subtitle; "" once fetched for apps without one, null when not fetched yet. */
  subtitle: text("subtitle"),
  developer: text("developer").notNull().default(""),
  developerId: text("developer_id"),
  bundleId: text("bundle_id"),
  iconUrl: text("icon_url"),
  genre: text("genre"),
  price: real("price").default(0),
  formattedPrice: text("formatted_price"),
  rating: real("rating"),
  ratingCount: integer("rating_count").default(0),
  description: text("description"),
  storeUrl: text("store_url"),
  releaseDate: timestamp("release_date"),
  updatedDate: timestamp("updated_date"),
  version: text("version"),
  country: text("country").notNull().default("US"),
  fetchedAt: createdAt("fetched_at"),
});

/** One-level folders for grouping tracked apps in the sidebar and on the home page. */
export const appFolders = sqliteTable("app_folders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  color: text("color").$type<FolderColor>().notNull().default("blue"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt("created_at"),
});

/** Apps the user has added to their sidebar. Deleting a folder moves its apps back to the top level. */
export const trackedApps = sqliteTable("tracked_apps", {
  appId: text("app_id")
    .primaryKey()
    .references(() => apps.id, { onDelete: "cascade" }),
  folderId: integer("folder_id").references(() => appFolders.id, { onDelete: "set null" }),
  defaultCountry: text("default_country").notNull().default("US"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt("created_at"),
});

/**
 * Shared keyword cache: one row per (term, country). Any app tracking the same
 * term in the same storefront reuses this row, so Apple is only hit once.
 */
export const keywords = sqliteTable(
  "keywords",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    term: text("term").notNull(),
    country: text("country").notNull(),
    popularity: integer("popularity"),
    difficulty: integer("difficulty"),
    resultCount: integer("result_count"),
    /** Ordered App Store search results (app ids), position = index + 1. */
    rankedAppIds: jsonArray("ranked_app_ids").notNull().$defaultFn(() => []),
    lastFetchedAt: timestamp("last_fetched_at"),
    createdAt: createdAt("created_at"),
  },
  (t) => [uniqueIndex("keywords_term_country_idx").on(t.term, t.country)],
);

/** Every fetch of a keyword appends a snapshot, which powers trends. */
export const keywordSnapshots = sqliteTable(
  "keyword_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => keywords.id, { onDelete: "cascade" }),
    popularity: integer("popularity"),
    difficulty: integer("difficulty"),
    resultCount: integer("result_count"),
    rankedAppIds: jsonArray("ranked_app_ids").notNull(),
    fetchedAt: createdAt("fetched_at"),
  },
  (t) => [index("keyword_snapshots_keyword_idx").on(t.keywordId, t.fetchedAt)],
);

/** Keywords a tracked app is following. */
export const appKeywords = sqliteTable(
  "app_keywords",
  {
    appId: text("app_id")
      .notNull()
      .references(() => trackedApps.appId, { onDelete: "cascade" }),
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => keywords.id, { onDelete: "cascade" }),
    notes: text("notes"),
    createdAt: createdAt("created_at"),
  },
  (t) => [primaryKey({ columns: [t.appId, t.keywordId] })],
);

/** Cached autocomplete hints (used for popularity estimation and suggestions). */
export const searchHints = sqliteTable(
  "search_hints",
  {
    prefix: text("prefix").notNull(),
    country: text("country").notNull(),
    hints: jsonArray("hints").notNull(),
    fetchedAt: createdAt("fetched_at"),
  },
  (t) => [primaryKey({ columns: [t.prefix, t.country] })],
);

export type App = typeof apps.$inferSelect;
export type NewApp = typeof apps.$inferInsert;
export type AppFolder = typeof appFolders.$inferSelect;
export type Keyword = typeof keywords.$inferSelect;
export type KeywordSnapshot = typeof keywordSnapshots.$inferSelect;
