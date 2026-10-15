# OpenASO

A local, self-hosted App Store Optimization (ASO) tool inspired by [Astro](https://tryastro.app). Track
keyword rankings for your iOS apps, research keyword popularity and difficulty, get keyword suggestions, and
look at competitors' keywords. It all runs on your machine, uses Apple's free public endpoints, and caches
results in a local SQLite database.

## Features

- **Apps**: search the App Store (or paste an App Store link or id) and add apps to the sidebar.
- **Keyword table**, per app and storefront, with these columns:
  - Popularity and difficulty bars
  - Current position, with the change since the last update
  - Position trend sparkline
  - Top-ranking app icons, plus the result count
  - Last update time and inline notes
  - Sorting, filtering, column visibility, multi-select bulk refresh/copy/remove
- **Add keywords** in bulk (comma or newline separated), with live App Store autocomplete as you type.
- **Get suggestions**: keyword ideas from the app's title and description, App Store autocomplete, and phrases
  competitors use in their titles. Each has an estimated popularity. A seed keyword is optional.
- **Ranking sheet**: the full ~250-app search ranking for any keyword. Click any app to see *its* keywords,
  add it to My Apps, or open it in the App Store.
- **Competitor keywords**: any app's page lists every cached keyword it ranks for. *Discover keywords*
  checks likely keywords for it automatically.
- **Keyword Explorer**: look up any keyword without tracking it, then track it for an app in one click.
- **Country switching**: 51 storefronts. The active one lives in the URL (`?country=GB`) and is remembered.
- **Caching and refresh**: keyword data is shared per term and storefront and reused while fresh (24h by
  default). Per-row, bulk, "outdated only" and "refresh all" buttons re-fetch on demand. Every fetch stores a
  snapshot, which is what powers the trends.
- Dark and light themes.

## Quick start

Requirements: Node 20+, pnpm.

```bash
pnpm install
cp .env.example .env     # optional; the defaults work as-is
pnpm dev                 # http://localhost:3000
```

The database is a SQLite file at `.data/openaso.db` (override with `DATABASE_PATH`). It's created, and
migrations are applied, whenever the server boots (`src/instrumentation.ts`).

### Useful scripts

| Script             | What it does                                 |
| ------------------ | -------------------------------------------- |
| `pnpm db:generate` | Generate a migration after editing the schema |
| `pnpm db:migrate`  | Apply migrations                             |
| `pnpm db:studio`   | Browse the database with Drizzle Studio      |
| `pnpm typecheck`   | TypeScript check                             |

## How the data works

Apple only exposes real search volume through the Search Ads API, which needs an account. OpenASO uses
free endpoints and estimates the rest:

| Data                | Source                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| Rankings / position | App Store search endpoint (`search.itunes.apple.com/.../MZStore.woa/wa/search`). Returns the same ordered ~250 results the App Store app shows. |
| App metadata        | iTunes Search & Lookup APIs (`itunes.apple.com/search`, `/lookup`)                                        |
| Autocomplete        | App Store search hints (`MZSearchHints.woa/wa/hints`)                                                     |

- **Popularity (5–100)**: estimated from autocomplete. OpenASO binary-searches for the shortest prefix at
  which Apple suggests the keyword: the fewer letters a user has to type, the more people search for it. The
  keyword's position in that suggestion list also counts. Keywords Apple never suggests get the minimum of 5,
  the same floor as Apple Search Ads.
- **Difficulty (1–100)**: how strong the current top 10 is. It is driven mostly by their review counts
  (log-scaled, with higher positions weighted more), plus a little for apps with the exact term in their
  title.

Both are heuristics, so treat them as relative signals rather than Apple's numbers. They track Astro's values
closely for low- and mid-volume keywords.

### Caching

- `keywords`: one row per *(term, storefront)*, shared by every app that tracks it. Requests within the TTL
  (`KEYWORD_CACHE_TTL_HOURS`, default 24) never touch Apple, and concurrent requests for the same keyword share
  one fetch.
- `keyword_snapshots`: appended on every fetch. Trends and position history come from here.
- `apps`: app metadata, refreshed weekly or when it's needed for a different storefront.
- `search_hints`: autocomplete responses, cached for 3 days.

Apple rate-limits these endpoints (roughly 20 requests a minute for the iTunes API). Requests are throttled per
host and retried with backoff. If you hit the limit, wait a minute and try again.

## Tech stack

Next.js 16 (App Router) · tRPC v11 · TanStack Query · TanStack Table v9 · Drizzle ORM · SQLite (better-sqlite3) ·
shadcn/ui (Radix) · Tailwind CSS v4 · nuqs · Zod

```
src/
├── app/                      # routes: home, /apps/[appId], /explore, /api/trpc
├── components/
│   ├── apps/                 # add-app dialog, app keywords page
│   ├── keywords/             # table, columns, ranking sheet, add/suggest dialogs
│   ├── explore/ home/ layout/ shared/
│   └── ui/                   # shadcn/ui primitives
├── hooks/                    # country (URL state), debounce, localStorage
├── lib/                      # countries/storefronts, formatting
├── server/
│   ├── apple/                # Apple endpoint clients + rate-limited fetch
│   ├── services/             # keyword cache, scoring, suggestions, app cache
│   ├── api/                  # tRPC routers
│   └── db/                   # Drizzle schema, client, migrator
└── trpc/                     # React tRPC client & query client
```
