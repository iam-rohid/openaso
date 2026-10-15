# OpenASO

A desktop App Store Optimization (ASO) app for macOS, Windows and Linux, inspired by [Astro](https://tryastro.app). Track
keyword rankings for your iOS apps, research keyword popularity and difficulty, get keyword suggestions, and
look at competitors' keywords. It all runs on your computer, uses Apple's free public endpoints, and caches
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
- **Country switching**: 51 storefronts. The active one carries across pages and is remembered between launches.
- **Caching and refresh**: keyword data is shared per term and storefront and reused while fresh (24h by
  default). Per-row, bulk, "outdated only" and "refresh all" buttons re-fetch on demand. Every fetch stores a
  snapshot, which is what powers the trends.
- Dark and light themes.

## Development

Requirements: Node 20+, pnpm.

```bash
pnpm install             # also rebuilds better-sqlite3 for Electron
pnpm dev                 # launches the app with hot reload
```

The database is a SQLite file in the app's data folder (`OpenASO Dev` in development, `OpenASO` when
installed), under `~/Library/Application Support` on macOS, `%APPDATA%` on Windows and `~/.config` on Linux.
It's created, and migrations are applied, on launch. Before an existing database is migrated it's copied to
`openaso.db.bak`.

### Useful scripts

| Script             | What it does                                       |
| ------------------ | -------------------------------------------------- |
| `pnpm dev`         | Run the app with hot reload                         |
| `pnpm build`       | Build main, preload and renderer into `out/`        |
| `pnpm preview`     | Run the production build                            |
| `pnpm db:generate` | Generate a migration after editing the schema       |
| `pnpm typecheck`   | TypeScript check                                    |
| `pnpm lint`        | ESLint                                              |

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
  (24 hours) never touch Apple, and concurrent requests for the same keyword share
  one fetch.
- `keyword_snapshots`: appended on every fetch. Trends and position history come from here.
- `apps`: app metadata, refreshed weekly or when it's needed for a different storefront.
- `search_hints`: autocomplete responses, cached for 3 days.

Apple rate-limits these endpoints (roughly 20 requests a minute for the iTunes API). Requests are throttled per
host and retried with backoff. If you hit the limit, wait a minute and try again.

## Tech stack

Electron · electron-vite · React 19 · TanStack Router · tRPC v11 (over IPC) · TanStack Query · TanStack Table v9 ·
Drizzle ORM · SQLite (better-sqlite3) · shadcn/ui (Radix) · Tailwind CSS v4 · Zod

The renderer talks to the main process through tRPC: its client `fetch` is routed over IPC, and the main process
answers with tRPC's fetch adapter, so there's no local server or open port.

```
src/
├── main/                     # Electron main process
│   ├── index.ts              # window, app lifecycle, database setup
│   ├── ipc.ts                # tRPC-over-IPC handler
│   ├── api/                  # tRPC routers
│   ├── apple/                # Apple endpoint clients + rate-limited fetch
│   ├── services/             # keyword cache, scoring, suggestions, app cache
│   └── db/                   # Drizzle schema, connection, migrator
├── preload/                  # exposes the IPC bridge to the renderer
├── renderer/                 # Vite + React UI
│   ├── index.html
│   └── src/
│       ├── routes/           # TanStack Router file routes: /, /explore, /apps/$appId, /folders/$folderId
│       ├── components/       # apps, keywords, explore, folders, layout, shared, ui (shadcn)
│       ├── hooks/            # country (URL state), debounce, localStorage
│       ├── lib/              # formatting, utils
│       └── trpc/             # tRPC client (IPC fetch) & query client
└── shared/                   # countries, folders, IPC types — used by both processes
```
