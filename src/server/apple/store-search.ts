import "server-only";
import { getCountry } from "@/lib/countries";
import { appleFetch } from "./http";
import type { AppleApp } from "./types";

/**
 * The App Store's own search endpoint. Unlike the iTunes Search API it returns the
 * exact ranking the App Store app shows (~250 results), plus rich metadata for the
 * first handful of results.
 */
const STORE_SEARCH_URL = "https://search.itunes.apple.com/WebObjects/MZStore.woa/wa/search";
const USER_AGENT = "AppStore/3.0 iOS/17.0 model/iPhone15,2 hwp/t8120 build/21A329 (6; dt:270)";

type Lockup = {
  id: string;
  name: string;
  artistName?: string;
  artistId?: string;
  bundleId?: string;
  artwork?: { url?: string };
  genreNames?: string[];
  offers?: { price?: number; priceFormatted?: string }[];
  userRating?: { value?: number; ratingCount?: number };
  releaseDate?: string;
  url?: string;
};

type StoreSearchResponse = {
  storePlatformData?: { "native-search-lockup"?: { results?: Record<string, Lockup> } };
  pageData?: { bubbles?: { results?: { id: string; entity?: string }[] }[] };
};

export type StoreSearchResult = {
  rankedAppIds: string[];
  /** Metadata Apple embedded for the top results; the rest needs a lookup. */
  apps: AppleApp[];
};

function lockupToApp(l: Lockup): AppleApp {
  return {
    id: String(l.id),
    name: l.name,
    developer: l.artistName ?? "",
    developerId: l.artistId ?? null,
    bundleId: l.bundleId ?? null,
    iconUrl: l.artwork?.url?.replace("{w}x{h}bb.{f}", "200x200bb.jpg") ?? null,
    genre: l.genreNames?.[0] ?? null,
    price: l.offers?.[0]?.price ?? 0,
    formattedPrice: l.offers?.[0]?.priceFormatted ?? null,
    rating: l.userRating?.value ?? null,
    ratingCount: l.userRating?.ratingCount ?? 0,
    description: null,
    storeUrl: l.url ?? null,
    releaseDate: l.releaseDate ? new Date(l.releaseDate) : null,
    updatedDate: null,
    version: null,
  };
}

export async function storeSearch(term: string, country: string): Promise<StoreSearchResult> {
  const { storefront } = getCountry(country);
  const url = `${STORE_SEARCH_URL}?${new URLSearchParams({
    clientApplication: "Software",
    media: "software",
    term,
  })}`;
  const res = await appleFetch(url, {
    headers: { "X-Apple-Store-Front": `${storefront},29`, "User-Agent": USER_AGENT },
  });
  const json = (await res.json()) as StoreSearchResponse;

  const rankedAppIds = (json.pageData?.bubbles?.[0]?.results ?? [])
    .filter((r) => !r.entity || r.entity === "software")
    .map((r) => String(r.id));
  const lockups = json.storePlatformData?.["native-search-lockup"]?.results ?? {};

  return {
    rankedAppIds: [...new Set(rankedAppIds)],
    apps: Object.values(lockups).map(lockupToApp),
  };
}
