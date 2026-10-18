import { eq, inArray } from "drizzle-orm";
import { db } from "@main/db";
import { appFolders, appKeywords, keywords, keywordSnapshots, trackedApps } from "@main/db/schema";
import { ensureApps } from "@main/services/apps";
import { addKeywordsToApp, getOrFetchKeyword } from "@main/services/keywords";
import { suggestKeywords } from "@main/services/suggestions";
import pLimit from "p-limit";
import { startOfLocalDay } from "@main/services/trends";

/**
 * Development only: fills an empty demo database with a real app, real keyword data
 * from Apple, and 30 days of made-up position history so trends and sparklines look
 * like a month of use. Used to take the marketing site's screenshots.
 */

const COUNTRY = "US";
const HISTORY_DAYS = 30;

const DEMO_APP = "1480220328"; // Tiimo: To-Do List Planner
const COMPETITORS = ["1499198946", "626144601", "572688855"]; // Structured, TickTick, Todoist

/** Candidates on top of the app's own suggestions; the seed keeps mostly ones it ranks for. */
const CANDIDATES = [
  "visual planner",
  "adhd planner",
  "adhd",
  "adhd app",
  "visual schedule",
  "visual timer",
  "routine planner",
  "daily routine",
  "morning routine",
  "neurodivergent",
  "autism",
  "executive function",
  "focus timer",
  "adhd to do list",
  "adhd reminders",
  "routine",
  "to do list",
  "to do",
  "planner",
  "daily planner",
  "day planner",
  "schedule planner",
  "time management",
  "habit planner",
  "task timer",
  "chores",
  "kids routine",
  "ai planner",
  "weekly planner",
  "calm",
];
const TRACKED = 32;
const UNRANKED = 4;

/** Small deterministic PRNG so re-seeding gives the same screenshots. */
function random(seed: number) {
  return () => {
    seed = (seed * 1_103_515_245 + 12_345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

/** Positions for the last `HISTORY_DAYS` days, oldest first, ending at `current`. */
function positionPath(current: number | null, rand: () => number): (number | null)[] {
  if (current == null) return Array.from({ length: HISTORY_DAYS }, () => null);
  const roll = rand();
  // Mostly climbing, some slipping, a few newly ranked: a month after a metadata update.
  const start =
    roll < 0.6
      ? current + Math.round(3 + rand() * Math.min(60, current * 2 + 12))
      : roll < 0.8
        ? Math.max(1, current - Math.round(1 + rand() * Math.min(12, current)))
        : current;
  const newSince = roll > 0.9 ? Math.floor(HISTORY_DAYS * (0.4 + rand() * 0.4)) : 0;
  return Array.from({ length: HISTORY_DAYS }, (_, i) => {
    if (i < newSince) return null;
    // Today is the real snapshot, one step past the last point here.
    const t = (i + 1) / (HISTORY_DAYS + 1);
    const noise = Math.round((rand() - 0.5) * Math.min(8, 1 + current * 0.25));
    return Math.max(1, Math.round(start + (current - start) * t) + noise);
  });
}

function withPosition(ranked: string[], appId: string, position: number | null) {
  const others = ranked.filter((id) => id !== appId);
  if (position == null) return others;
  others.splice(Math.min(position - 1, others.length), 0, appId);
  return others;
}

export async function seedDemo() {
  const existing = await db.select().from(trackedApps).limit(1);
  if (existing.length > 0) return;
  console.log("[seed-demo] seeding demo database…");

  await ensureApps([DEMO_APP, ...COMPETITORS], COUNTRY, { requireFull: true });
  const [folder] = await db.insert(appFolders).values({ name: "Competitors", color: "purple" }).returning();
  await db.insert(trackedApps).values([
    { appId: DEMO_APP, defaultCountry: COUNTRY, sortOrder: 1 },
    ...COMPETITORS.map((appId, i) => ({ appId, folderId: folder.id, defaultCountry: COUNTRY, sortOrder: i + 2 })),
  ]);

  const suggested = (await suggestKeywords(DEMO_APP, COUNTRY)).slice(0, 30).map((s) => s.term);
  const terms = [...new Set([...CANDIDATES, ...suggested])];
  const limit = pLimit(4);
  const fetched = (
    await Promise.allSettled(terms.map((t) => limit(() => getOrFetchKeyword(t, COUNTRY))))
  ).flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const byPopularity = fetched.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  const ranked = byPopularity.filter((k) => k.rankedAppIds.includes(DEMO_APP));
  const unranked = byPopularity.filter((k) => !k.rankedAppIds.includes(DEMO_APP));
  const chosen = [...ranked.slice(0, TRACKED - UNRANKED), ...unranked.slice(0, UNRANKED)];
  const { added } = await addKeywordsToApp(
    DEMO_APP,
    COUNTRY,
    chosen.map((k) => k.term),
  );
  console.log(`[seed-demo] checked ${fetched.length} keywords, tracking ${added} (${ranked.length} ranked)`);

  const links = await db.select().from(appKeywords).where(eq(appKeywords.appId, DEMO_APP));
  const rows = await db
    .select()
    .from(keywords)
    .where(
      inArray(
        keywords.id,
        links.map((l) => l.keywordId),
      ),
    );

  const rand = random(42);
  const firstDay = startOfLocalDay(new Date(), HISTORY_DAYS + 1);
  for (const k of rows) {
    const index = k.rankedAppIds.indexOf(DEMO_APP);
    const path = positionPath(index === -1 ? null : index + 1, rand);
    await db.insert(keywordSnapshots).values(
      path.map((position, i) => {
        const fetchedAt = startOfLocalDay(new Date(), HISTORY_DAYS - i);
        fetchedAt.setHours(9, Math.floor(rand() * 60));
        const ranked = withPosition(k.rankedAppIds, DEMO_APP, position);
        const jitter = (v: number | null) => (v == null ? v : Math.max(5, v + Math.round((rand() - 0.5) * 4)));
        return {
          keywordId: k.id,
          popularity: jitter(k.popularity),
          difficulty: jitter(k.difficulty),
          resultCount: ranked.length,
          rankedAppIds: ranked,
          fetchedAt,
        };
      }),
    );
    await db.update(keywords).set({ createdAt: firstDay }).where(eq(keywords.id, k.id));
  }
  await db.update(appKeywords).set({ createdAt: firstDay }).where(eq(appKeywords.appId, DEMO_APP));
  console.log("[seed-demo] done");
}
