import { COUNTRY_CODES, DEFAULT_COUNTRY, type CountryCode } from "@shared/countries";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";

/** Where the single app-wide storefront used to be saved; it seeds the per-view defaults. */
const LEGACY_KEY = "openaso:country";

export function parseCountry(value: unknown): CountryCode | undefined {
  return COUNTRY_CODES.includes(value as CountryCode) ? (value as CountryCode) : undefined;
}

function legacyCountry() {
  try {
    return parseCountry(localStorage.getItem(LEGACY_KEY));
  } catch {
    return undefined;
  }
}

/**
 * A storefront remembered per view (e.g. the keyword explorer) in localStorage. Apps
 * keep their own storefront in the database instead; there is no app-wide country.
 */
export function useStoredCountry(key: string) {
  const [stored, setStored] = useLocalStorageState<string | null>(key, null);
  const country = parseCountry(stored) ?? legacyCountry() ?? DEFAULT_COUNTRY;
  return [country, setStored as (code: CountryCode) => void] as const;
}
