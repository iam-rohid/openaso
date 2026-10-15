import { appleFetch } from "./http";
import type { AppleApp } from "./types";

/** Raw shape of a software result from the iTunes Search / Lookup API. */
type ItunesSoftware = {
  trackId: number;
  trackName: string;
  artistName: string;
  artistId?: number;
  bundleId?: string;
  artworkUrl512?: string;
  artworkUrl100?: string;
  primaryGenreName?: string;
  price?: number;
  formattedPrice?: string;
  averageUserRating?: number;
  userRatingCount?: number;
  description?: string;
  trackViewUrl?: string;
  releaseDate?: string;
  currentVersionReleaseDate?: string;
  version?: string;
  wrapperType?: string;
  kind?: string;
};

const BASE = "https://itunes.apple.com";
const LOOKUP_CHUNK = 150;

function toApp(r: ItunesSoftware): AppleApp {
  return {
    id: String(r.trackId),
    name: r.trackName,
    subtitle: null,
    developer: r.artistName ?? "",
    developerId: r.artistId ? String(r.artistId) : null,
    bundleId: r.bundleId ?? null,
    // Swap the 512px artwork for a crisp 200px variant to keep payloads light.
    iconUrl: (r.artworkUrl512 ?? r.artworkUrl100)?.replace(/\/\d+x\d+bb\./, "/200x200bb.") ?? null,
    genre: r.primaryGenreName ?? null,
    price: r.price ?? 0,
    formattedPrice: r.formattedPrice ?? null,
    rating: r.averageUserRating ?? null,
    ratingCount: r.userRatingCount ?? 0,
    description: r.description ?? null,
    storeUrl: r.trackViewUrl?.split("?")[0] ?? null,
    releaseDate: r.releaseDate ? new Date(r.releaseDate) : null,
    updatedDate: r.currentVersionReleaseDate ? new Date(r.currentVersionReleaseDate) : null,
    version: r.version ?? null,
  };
}

const isSoftware = (r: ItunesSoftware) =>
  r.wrapperType === "software" || r.kind === "software" || r.kind === "mac-software";

/** Free-text app search (used by the "Add App" dialog). */
export async function searchApps(term: string, country: string, limit = 25): Promise<AppleApp[]> {
  const url = `${BASE}/search?${new URLSearchParams({
    term,
    country: country.toLowerCase(),
    entity: "software",
    media: "software",
    limit: String(limit),
  })}`;
  const res = await appleFetch(url);
  const json = (await res.json()) as { results: ItunesSoftware[] };
  return json.results.filter(isSoftware).map(toApp);
}

/** Bulk metadata lookup by track id, chunked to stay within URL limits. */
export async function lookupApps(ids: string[], country: string): Promise<AppleApp[]> {
  const unique = [...new Set(ids)];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += LOOKUP_CHUNK) chunks.push(unique.slice(i, i + LOOKUP_CHUNK));

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const url = `${BASE}/lookup?${new URLSearchParams({
        id: chunk.join(","),
        country: country.toLowerCase(),
        entity: "software",
      })}`;
      const res = await appleFetch(url);
      const json = (await res.json()) as { results: ItunesSoftware[] };
      return json.results.filter(isSoftware).map(toApp);
    }),
  );
  return results.flat();
}
