import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@main/db";
import { appKeywords, apps, keywords } from "@main/db/schema";
import { COUNTRY_CODES, countryFlag, type CountryCode } from "@shared/countries";
import type { TrendWindow } from "@shared/trends";
import { listTrackedKeywords, normalizeTerm, type KeywordRow } from "./keywords";

/**
 * Keyword import/export in Astro's CSV format, so lists move between the two apps.
 * Astro writes 1000 as the ranking of an app that isn't in the results.
 */
const ASTRO_COLUMNS = [
  "App Name",
  "App Id",
  "Platform",
  "Keyword",
  "Store Domain",
  "Store",
  "Note",
  "Last Update",
  "Ranking",
  "Change",
  "Popularity",
  "Difficulty",
  "Apps in Ranking",
  "Tags",
] as const;
const UNRANKED = 1000;
const MAX_TERM_LENGTH = 100;
const MAX_NOTE_LENGTH = 500;
const IMPORT_CHUNK = 500;

// --- CSV (RFC 4180) ---

function csvField(value: string | number | null) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number | null)[][]) {
  return rows.map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}

/** Parses CSV text into rows of fields; tolerates a UTF-8 BOM and CRLF or LF line endings. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Blank lines parse as a single empty field.
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

// --- Export ---

/** Astro's timestamp format, in UTC: `2026-08-31 19:35:08 +0000`. */
function astroTimestamp(date: Date | null) {
  return date ? `${date.toISOString().slice(0, 19).replace("T", " ")} +0000` : "";
}

/** Positions gained over the window (positive = moved up), counting "not ranked" as Astro's 1000. */
function astroChange(row: KeywordRow, window: TrendWindow) {
  const trend = row.trends[window];
  switch (trend.state) {
    case "up":
    case "down":
    case "same":
      return trend.delta ?? 0;
    case "new":
      return row.position == null ? 0 : UNRANKED - row.position;
    case "lost": {
      const baseline = row.history.find((d) => d?.at.getTime() === trend.baselineAt?.getTime());
      return baseline?.position == null ? 0 : baseline.position - UNRANKED;
    }
    default:
      return 0;
  }
}

export async function exportKeywordsCsv(appId: string, country: CountryCode, window: TrendWindow) {
  const [app] = await db
    .select({ name: apps.name, isTemporary: apps.isTemporary })
    .from(apps)
    .where(eq(apps.id, appId));
  const rows = await listTrackedKeywords(appId, country);
  const store = `${countryFlag(country)} ${country}`;

  const csv = toCsv([
    [...ASTRO_COLUMNS],
    ...rows.map((k) => [
      app?.name ?? "",
      appId,
      "iphone",
      k.term,
      country.toLowerCase(),
      store,
      k.notes ?? "",
      astroTimestamp(k.lastFetchedAt),
      app?.isTemporary ? UNRANKED : (k.position ?? UNRANKED),
      app?.isTemporary ? 0 : astroChange(k, window),
      k.popularity,
      k.difficulty,
      k.resultCount,
      "",
    ]),
  ]);
  return { csv, appName: app?.name ?? appId, count: rows.length };
}

// --- Import ---

export class KeywordCsvError extends Error {}

type ImportRow = {
  term: string;
  country: CountryCode;
  note: string | null;
  popularity: number | null;
  difficulty: number | null;
  resultCount: number | null;
};

function toInt(value: string | undefined) {
  const n = value ? Number(value.trim()) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}

function toCountry(value: string | undefined): CountryCode | null {
  const code = value?.trim().toUpperCase();
  return code && (COUNTRY_CODES as string[]).includes(code) ? (code as CountryCode) : null;
}

/** Reads rows by header name (any order, case-insensitive); only `Keyword` is required. */
export function readImportRows(text: string, fallbackCountry: CountryCode) {
  const [header, ...lines] = parseCsv(text);
  const columns = (header ?? []).map((h) => h.trim().toLowerCase());
  const col = (name: string) => columns.indexOf(name.toLowerCase());
  const keywordCol = col("Keyword");
  if (keywordCol < 0) throw new KeywordCsvError("This file has no “Keyword” column.");
  const [countryCol, noteCol, popularityCol, difficultyCol, resultsCol] = [
    "Store Domain",
    "Note",
    "Popularity",
    "Difficulty",
    "Apps in Ranking",
  ].map(col);

  // One row per term and storefront; the first non-empty note wins.
  const byKey = new Map<string, ImportRow>();
  let skipped = 0;
  for (const line of lines) {
    const term = normalizeTerm(line[keywordCol] ?? "");
    if (!term || term.length > MAX_TERM_LENGTH) {
      skipped++;
      continue;
    }
    const country = toCountry(line[countryCol]) ?? fallbackCountry;
    const note = (line[noteCol] ?? "").trim().slice(0, MAX_NOTE_LENGTH) || null;
    const key = `${country}:${term}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.note ??= note;
      continue;
    }
    byKey.set(key, {
      term,
      country,
      note,
      popularity: toInt(line[popularityCol]),
      difficulty: toInt(line[difficultyCol]),
      resultCount: toInt(line[resultsCol]),
    });
  }
  return { rows: [...byKey.values()], skipped };
}

/**
 * Links imported keywords to an app without hitting Apple. Terms we haven't cached yet are
 * seeded from the file's figures and left unfetched (so they show as outdated); the returned
 * `newKeywordIds` are the ones to refresh. Existing notes are never overwritten.
 */
export function importKeywords(appId: string, rows: ImportRow[]) {
  const added: Partial<Record<CountryCode, number>> = {};
  let alreadyTracked = 0;
  const newKeywordIds: number[] = [];

  for (const [country, all] of Map.groupBy(rows, (r) => r.country)) {
    // Chunked to stay well under SQLite's bound-parameter limit on large files.
    for (let i = 0; i < all.length; i += IMPORT_CHUNK) {
      const group = all.slice(i, i + IMPORT_CHUNK);
      db.transaction((tx) => {
        const terms = group.map((r) => r.term);
        const created = tx
          .insert(keywords)
          .values(
            group.map((r) => ({
              term: r.term,
              country,
              popularity: r.popularity,
              difficulty: r.difficulty,
              resultCount: r.resultCount,
            })),
          )
          .onConflictDoNothing()
          .returning({ id: keywords.id })
          .all();
        newKeywordIds.push(...created.map((k) => k.id));

        const ids = new Map(
          tx
            .select({ id: keywords.id, term: keywords.term })
            .from(keywords)
            .where(and(eq(keywords.country, country), inArray(keywords.term, terms)))
            .all()
            .map((k) => [k.term, k.id]),
        );
        for (const r of group) {
          const keywordId = ids.get(r.term)!;
          const linked = tx
            .insert(appKeywords)
            .values({ appId, keywordId, notes: r.note })
            .onConflictDoNothing()
            .returning({ keywordId: appKeywords.keywordId })
            .all();
          if (linked.length > 0) {
            added[country] = (added[country] ?? 0) + 1;
            continue;
          }
          alreadyTracked++;
          if (r.note) {
            tx.update(appKeywords)
              .set({ notes: r.note })
              .where(and(eq(appKeywords.appId, appId), eq(appKeywords.keywordId, keywordId), isNull(appKeywords.notes)))
              .run();
          }
        }
      });
    }
  }
  return { added, alreadyTracked, newKeywordIds };
}
