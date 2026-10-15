import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";
import { COUNTRY_CODES, DEFAULT_COUNTRY, type CountryCode } from "@shared/countries";

const STORAGE_KEY = "openaso:country";

export function parseCountry(value: unknown): CountryCode | undefined {
  return COUNTRY_CODES.includes(value as CountryCode) ? (value as CountryCode) : undefined;
}

/** The storefront the app was last left on, used to restore it at launch. */
export function savedCountry() {
  try {
    return parseCountry(localStorage.getItem(STORAGE_KEY));
  } catch {
    return undefined;
  }
}

/**
 * Active storefront, kept in the URL (`?country=GB`) so it survives back/forward and
 * carries across links (see `retainSearchParams` on the root route), and remembered
 * in localStorage for the next launch.
 */
export function useCountry() {
  const country = useSearch({ strict: false, select: (s) => s.country }) ?? DEFAULT_COUNTRY;
  const navigate = useNavigate();

  const setCountry = useCallback(
    (code: CountryCode) => {
      try {
        localStorage.setItem(STORAGE_KEY, code);
      } catch {
        // Storage may be unavailable; the choice just won't persist.
      }
      void navigate({
        to: ".",
        search: (prev) => ({ ...prev, country: code === DEFAULT_COUNTRY ? undefined : code }),
        replace: true,
      });
    },
    [navigate],
  );

  return [country, setCountry] as const;
}
