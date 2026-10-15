"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useEffect } from "react";
import { COUNTRY_CODES, DEFAULT_COUNTRY, type CountryCode } from "@/lib/countries";

const STORAGE_KEY = "free-astro:country";
const countryParser = parseAsStringLiteral(COUNTRY_CODES).withDefault(DEFAULT_COUNTRY);

/**
 * Active storefront, kept in the URL (`?country=GB`) so views are shareable, and
 * remembered in localStorage so it survives navigation to URLs without the param.
 */
export function useCountry() {
  const [country, setCountryParam] = useQueryState("country", countryParser);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("country")) return;
    const saved = window.localStorage.getItem(STORAGE_KEY) as CountryCode | null;
    if (saved && saved !== DEFAULT_COUNTRY && COUNTRY_CODES.includes(saved)) {
      void setCountryParam(saved);
    }
  }, [setCountryParam]);

  const setCountry = useCallback(
    (code: CountryCode) => {
      window.localStorage.setItem(STORAGE_KEY, code);
      void setCountryParam(code === DEFAULT_COUNTRY ? null : code);
    },
    [setCountryParam],
  );

  return [country, setCountry] as const;
}

/** Appends the active country to an internal href. */
export function withCountry(href: string, country: CountryCode) {
  if (country === DEFAULT_COUNTRY) return href;
  return `${href}${href.includes("?") ? "&" : "?"}country=${country}`;
}
