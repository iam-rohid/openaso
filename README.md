# OpenASO

A desktop App Store Optimization (ASO) app for macOS, Windows and Linux, inspired by [Astro](https://tryastro.app). Track
keyword rankings for your iOS apps, research keyword popularity and difficulty, get keyword suggestions, and
look at competitors' keywords. It all runs on your computer, uses Apple's free public endpoints, and caches
results in a local SQLite database.

## Install

Download the installer for your system from the
[latest release](https://github.com/iam-rohid/openaso/releases/latest):

| System                | File                                                 |
| --------------------- | ---------------------------------------------------- |
| macOS (Apple Silicon) | `OpenASO-<version>-mac-arm64.dmg`                    |
| macOS (Intel)         | `OpenASO-<version>-mac-x64.dmg`                      |
| Windows               | `OpenASO-<version>-windows-setup.exe`                |
| Linux                 | `OpenASO-<version>-linux-*.AppImage` or `.deb`       |

Nothing else is needed: no Node, Docker or database server. Your data is stored on your computer (Help → Open
Data Folder shows where).

- **macOS**: open the `.dmg` and drag OpenASO to Applications. The app is signed and notarized from v0.3.0.
  (Versions before that weren't: if macOS says one "is damaged", run `xattr -cr /Applications/OpenASO.app`.)
- **Windows**: the installer isn't code-signed yet. If SmartScreen shows "Windows protected your PC", click
  **More info → Run anyway**.
- **Linux**: make the AppImage executable (`chmod +x OpenASO-*.AppImage`) and run it, or install the `.deb`
  with `sudo apt install ./OpenASO-*.deb`.

**Updates**: OpenASO checks for a new version on launch and every few hours (or from *Check for Updates…* in
the menu), and downloads it in the background. When it's ready, a **Restart to update** button appears at the
bottom of the sidebar; otherwise it installs the next time you quit. With the `.deb`, the button links to the
new release to download instead. If you're on macOS v0.2.0 or earlier, download v0.3.0 by hand once.

## Features

- **Apps**: search the App Store (or paste an App Store link or id) and add apps to the sidebar.
- **Keyword table**, per app and storefront, with these columns:
  - Popularity and difficulty bars
  - Current position
  - Trend: the position change over 1, 7 or 30 days (one switch for the whole page), with *New* and *Lost*
    for keywords that entered or dropped out of the results, and a 30-day daily sparkline
  - Top-ranking app icons, plus the result count
  - Last update time and inline notes
  - Sorting, filtering, column visibility, multi-select bulk refresh/copy/remove
- **Add keywords** in bulk (comma or newline separated), with live App Store autocomplete as you type.
- **Get suggestions**: keyword ideas from the app's title and description, App Store autocomplete, and phrases
  competitors use in their titles. Each has an estimated popularity. A seed keyword is optional.
- **Ranking summary** above each app's keywords: how many are in the top 10, top 50 and ranked at all, how
  that changed over the trend window, and a 30-day chart with the biggest gains, drops, new and lost keywords.
- **Ranking sheet**: the full ~250-app search ranking for any keyword. Click any app to see *its* keywords,
  add it to My Apps, or open it in the App Store.
- **Competitor keywords**: any app's page lists every cached keyword it ranks for. *Discover keywords*
  checks likely keywords for it automatically.
- **Keyword Explorer**: look up any keyword without tracking it, then track it for an app in one click.
- **Country switching**: 51 storefronts. The active one carries across pages and is remembered between launches.
- **Caching and refresh**: keyword data is shared per term and storefront and reused while fresh (24h by
  default). Per-row, bulk, "outdated only" and "refresh all" buttons re-fetch on demand. Every fetch stores a
  snapshot, which is what powers the trends.
- **Daily ranking updates**: while the app is open, every tracked keyword is refreshed once per day (on launch,
  hourly checks and on wake), so trends get one point per day. Days the app wasn't open stay as gaps. It
  backs off when Apple rate limits, refreshes the app you're looking at first, and can be turned off from the
  sidebar.
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
| `pnpm dist`        | Build installers for this OS into `dist/`           |
| `pnpm db:generate` | Generate a migration after editing the schema       |
| `pnpm typecheck`   | TypeScript check                                    |
| `pnpm lint`        | ESLint                                              |

### Releasing

1. Bump `version` in `package.json` and commit.
2. Tag and push: `git tag v0.2.0 && git push origin main v0.2.0`.
3. The [Release workflow](.github/workflows/release.yml) creates a **draft** GitHub Release with notes
   generated from the `feat:`, `fix:` and `perf:` commits since the previous tag ([cliff.toml](cliff.toml)),
   then builds the macOS (signed and notarized, see [docs/code-signing.md](docs/code-signing.md)), Windows
   and Linux installers and uploads them to it.
4. Edit the notes if needed; the app shows them in its *What's new* dialog. Check that `latest-mac.yml`,
   `latest.yml` and `latest-linux.yml` were uploaded: a platform without its file silently stops updating.
5. Publish the draft. Installed apps only see published releases, and pick them up within a few hours.

To try a build locally: `pnpm dist` (installers for this OS in `dist/`) or `pnpm dist:dir` (just the app).

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
- `keyword_snapshots`: appended on every fetch. Trends and position history come from here, using each
  day's last snapshot. After 48 hours only that one is kept, and after 90 days snapshots keep just the top
  100 results.
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
