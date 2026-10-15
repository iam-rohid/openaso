import { getCountry } from "@shared/countries";
import { appleFetch } from "./http";

/** App Store search autocomplete — the same suggestions users see while typing. */
const HINTS_URL = "https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints";

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
};

function decode(value: string) {
  return value
    .replace(/&(amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

export async function fetchSearchHints(prefix: string, country: string): Promise<string[]> {
  const { storefront } = getCountry(country);
  const url = `${HINTS_URL}?${new URLSearchParams({ clientApplication: "Software", term: prefix })}`;
  const res = await appleFetch(url, { headers: { "X-Apple-Store-Front": `${storefront},29` } });
  const xml = await res.text();
  return [...xml.matchAll(/<key>term<\/key>\s*<string>([\s\S]*?)<\/string>/g)].map((m) =>
    decode(m[1]).trim().toLowerCase(),
  );
}
