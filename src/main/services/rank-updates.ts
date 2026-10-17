import { eq, isNull, lt, or, sql } from "drizzle-orm";
import { powerMonitor } from "electron";
import { loadAppState, saveAppState } from "@main/app-state";
import { AppleApiError } from "@main/apple/http";
import { db } from "@main/db";
import { appKeywords, keywords } from "@main/db/schema";
import { compactSnapshots } from "./compaction";
import { getOrFetchKeyword } from "./keywords";
import { startOfLocalDay } from "./trends";

/**
 * Daily background refresh of every tracked keyword, so trends get one point per day.
 * It's driven by staleness rather than a clock: on launch, hourly while the app is open
 * and on wake, it refreshes tracked keywords not fetched since local midnight. Days the
 * app wasn't open stay as gaps.
 */

/** Lower than manual refreshes: this runs unattended over every app's keywords. */
const CONCURRENCY = 2;
const CHECK_INTERVAL_MS = 3_600_000;
/** Let the window load before the first run competes with it for Apple's rate limit. */
const STARTUP_DELAY_MS = 15_000;
/** When Apple throttles, the run stops and resumes after these pauses (minutes), backing off. */
const PAUSE_MINUTES = [5, 15, 60];

export type RankUpdateStatus = {
  enabled: boolean;
  running: boolean;
  done: number;
  total: number;
  failed: number;
  lastCompletedAt: Date | null;
  /** Set while the run waits out Apple's rate limiting. */
  pausedUntil: Date | null;
};

type DueKeyword = { id: number; term: string; country: string; appIds: string[] };

let enabled = loadAppState().autoUpdateRankings ?? true;
let running = false;
let queue: DueKeyword[] = [];
let progress = { done: 0, total: 0, failed: 0 };
let lastCompletedAt: Date | null = null;
let pausedUntil: Date | null = null;
let pauses = 0;
let resumeTimer: NodeJS.Timeout | undefined;
let compactedDay: number | null = null;
/** The app page being viewed; its keywords go first. */
let focus: { appId: string; country: string } | null = null;

export function getRankUpdateStatus(): RankUpdateStatus {
  return { enabled, running, ...progress, lastCompletedAt, pausedUntil };
}

export function setRankUpdatesEnabled(next: boolean) {
  enabled = next;
  saveAppState({ autoUpdateRankings: next });
  if (next) void checkRankUpdates();
  else queue = [];
}

export function setRankUpdateFocus(next: { appId: string; country: string } | null) {
  focus = next;
}

export function startRankUpdates() {
  setTimeout(() => void checkRankUpdates(), STARTUP_DELAY_MS);
  setInterval(() => void checkRankUpdates(), CHECK_INTERVAL_MS);
  // A laptop opened in the morning should update without waiting for the hourly check.
  powerMonitor.on("resume", () => void checkRankUpdates());
}

/** Tracked keywords not fetched since local midnight, most popular first. */
async function findDueKeywords(): Promise<DueKeyword[]> {
  return db
    .select({
      id: keywords.id,
      term: keywords.term,
      country: keywords.country,
      appIds: sql<string[]>`json_group_array(${appKeywords.appId})`.mapWith((v: string) => JSON.parse(v)),
    })
    .from(keywords)
    .innerJoin(appKeywords, eq(appKeywords.keywordId, keywords.id))
    .where(or(isNull(keywords.lastFetchedAt), lt(keywords.lastFetchedAt, startOfLocalDay())))
    .groupBy(keywords.id)
    .orderBy(sql`${keywords.popularity} desc nulls last`);
}

/** The next keyword to refresh, preferring the one the user is looking at. */
function takeNext() {
  const i = focus
    ? queue.findIndex((k) => k.country === focus!.country && k.appIds.includes(focus!.appId))
    : -1;
  return queue.splice(Math.max(i, 0), 1)[0];
}

/** Rate limiting or no connection: carrying on would only fail the rest of the queue. */
function shouldPause(err: unknown) {
  if (err instanceof AppleApiError) return err.status === 403 || err.status === 429 || err.status == null;
  return true;
}

function pause() {
  queue = [];
  const minutes = PAUSE_MINUTES[Math.min(pauses, PAUSE_MINUTES.length - 1)];
  pauses++;
  pausedUntil = new Date(Date.now() + minutes * 60_000);
  clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => void checkRankUpdates(), minutes * 60_000);
}

async function refreshOne(keyword: DueKeyword) {
  // A manual refresh may have got there first.
  const [row] = await db
    .select({ lastFetchedAt: keywords.lastFetchedAt })
    .from(keywords)
    .where(eq(keywords.id, keyword.id))
    .limit(1);
  if (!row || (row.lastFetchedAt && row.lastFetchedAt >= startOfLocalDay())) return;
  await getOrFetchKeyword(keyword.term, keyword.country, { force: true });
}

async function worker() {
  while (queue.length > 0) {
    const keyword = takeNext();
    try {
      await refreshOne(keyword);
    } catch (err) {
      progress.failed++;
      if (shouldPause(err)) pause();
    }
    progress.done++;
  }
}

/** Starts a run if anything is due (and nothing is running or paused). */
export async function checkRankUpdates() {
  if (!enabled || running) return;
  if (pausedUntil && pausedUntil > new Date()) return;
  running = true;
  pausedUntil = null;
  try {
    queue = await findDueKeywords();
    progress = { done: 0, total: queue.length, failed: 0 };
    if (queue.length > 0) {
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      if (!pausedUntil) {
        pauses = 0;
        lastCompletedAt = new Date();
      }
    }
    // Once a day is enough; the first check after midnight does it.
    const today = startOfLocalDay().getTime();
    if (compactedDay !== today) {
      compactSnapshots();
      compactedDay = today;
    }
  } catch (err) {
    console.error("Rank update failed", err);
  } finally {
    running = false;
    queue = [];
  }
}
