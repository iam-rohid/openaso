import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { FolderColor } from "../../lib/folders";

/**
 * Cached App Store metadata. Keyed by Apple's numeric track id (stored as text).
 * Rating figures are taken from the storefront the app was last fetched in.
 */
export const apps = pgTable("apps", {
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
  releaseDate: timestamp("release_date", { withTimezone: true }),
  updatedDate: timestamp("updated_date", { withTimezone: true }),
  version: text("version"),
  country: text("country").notNull().default("US"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One-level folders for grouping tracked apps in the sidebar and on the home page. */
export const appFolders = pgTable("app_folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").$type<FolderColor>().notNull().default("blue"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Apps the user has added to their sidebar. Deleting a folder moves its apps back to the top level. */
export const trackedApps = pgTable("tracked_apps", {
  appId: text("app_id")
    .primaryKey()
    .references(() => apps.id, { onDelete: "cascade" }),
  folderId: integer("folder_id").references(() => appFolders.id, { onDelete: "set null" }),
  defaultCountry: text("default_country").notNull().default("US"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Shared keyword cache: one row per (term, country). Any app tracking the same
 * term in the same storefront reuses this row, so Apple is only hit once.
 */
export const keywords = pgTable(
  "keywords",
  {
    id: serial("id").primaryKey(),
    term: text("term").notNull(),
    country: text("country").notNull(),
    popularity: integer("popularity"),
    difficulty: integer("difficulty"),
    resultCount: integer("result_count"),
    /** Ordered App Store search results (app ids), position = index + 1. */
    rankedAppIds: jsonb("ranked_app_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("keywords_term_country_idx").on(t.term, t.country),
    index("keywords_ranked_app_ids_idx").using("gin", t.rankedAppIds),
  ],
);

/** Every fetch of a keyword appends a snapshot, which powers trends. */
export const keywordSnapshots = pgTable(
  "keyword_snapshots",
  {
    id: serial("id").primaryKey(),
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => keywords.id, { onDelete: "cascade" }),
    popularity: integer("popularity"),
    difficulty: integer("difficulty"),
    resultCount: integer("result_count"),
    rankedAppIds: jsonb("ranked_app_ids").$type<string[]>().notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("keyword_snapshots_keyword_idx").on(t.keywordId, t.fetchedAt)],
);

/** Keywords a tracked app is following. */
export const appKeywords = pgTable(
  "app_keywords",
  {
    appId: text("app_id")
      .notNull()
      .references(() => trackedApps.appId, { onDelete: "cascade" }),
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => keywords.id, { onDelete: "cascade" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.appId, t.keywordId] })],
);

/** Cached autocomplete hints (used for popularity estimation and suggestions). */
export const searchHints = pgTable(
  "search_hints",
  {
    prefix: text("prefix").notNull(),
    country: text("country").notNull(),
    hints: jsonb("hints").$type<string[]>().notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.prefix, t.country] })],
);

export type App = typeof apps.$inferSelect;
export type NewApp = typeof apps.$inferInsert;
export type AppFolder = typeof appFolders.$inferSelect;
export type Keyword = typeof keywords.$inferSelect;
export type KeywordSnapshot = typeof keywordSnapshots.$inferSelect;
