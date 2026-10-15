import { getHints } from "./hints";

/**
 * Popularity (5–100) — Apple only exposes real search volume through Search Ads, so
 * we estimate it the way many indie ASO tools do: from App Store autocomplete. The
 * fewer characters a user must type before Apple suggests the keyword (and the
 * higher it is in the list), the more people search for it.
 *
 * Score by minimal prefix length (chars typed before it's suggested):
 *   1 → ~90, 2 → ~68, 3 → ~54, 4 → ~42, 5 → ~30, 6 → ~18, 7 → ~11, 8+ → ~7
 * Terms Apple never suggests (even when fully typed) get the floor of 5,
 * mirroring Apple Search Ads' minimum.
 */
const POPULARITY_BY_PREFIX = [90, 68, 54, 42, 30, 18, 11, 7];
export const MIN_POPULARITY = 5;

export async function estimatePopularity(term: string, country: string): Promise<number> {
  const full = await getHints(term, country);
  if (!full.includes(term)) return MIN_POPULARITY;

  // Binary search for the shortest prefix whose suggestions include the term.
  // Suggestion membership is (nearly) monotonic in prefix length.
  let lo = 1;
  let hi = term.length;
  let index = full.indexOf(term);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const hints = await getHints(term.slice(0, mid), country);
    const i = hints.indexOf(term);
    if (i >= 0) {
      hi = mid;
      index = i;
    } else {
      lo = mid + 1;
    }
  }
  if (lo === term.length) index = full.indexOf(term);

  const base = POPULARITY_BY_PREFIX[Math.min(lo, POPULARITY_BY_PREFIX.length) - 1];
  // Lower positions in the suggestion list lose up to ~27% of the score.
  const score = base * (1 - Math.min(index, 9) * 0.03);
  return Math.max(MIN_POPULARITY, Math.round(score));
}

type RankedAppStats = { ratingCount: number | null; name: string } | undefined;

/**
 * Difficulty (1–100) — how hard it is to break into the top 10. Driven by the
 * review volume of the apps already ranking (log-scaled, ~1M ratings ≈ max) with
 * higher positions weighted more, plus a small bump when incumbents target the
 * exact term in their title. Sparse result sets are naturally easier.
 */
export function computeDifficulty(topApps: RankedAppStats[], term: string): number {
  const slots = topApps.slice(0, 10);
  if (slots.length === 0) return 1;

  let weighted = 0;
  let weights = 0;
  let titleMatches = 0;
  for (let i = 0; i < 10; i++) {
    const app = slots[i];
    const weight = 1 / (1 + 0.15 * i);
    const strength = app ? Math.min(1, Math.log10((app.ratingCount ?? 0) + 1) / 6) : 0;
    weighted += strength * weight;
    weights += weight;
    if (app?.name.toLowerCase().includes(term)) titleMatches++;
  }

  const strength = weighted / weights;
  const score = 100 * strength ** 2 + titleMatches * 1.5;
  return Math.min(100, Math.max(1, Math.round(score)));
}
