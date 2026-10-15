export type Country = {
  code: string;
  name: string;
  /** App Store storefront id, sent as the X-Apple-Store-Front header. */
  storefront: number;
};

export const COUNTRIES = [
  { code: "US", name: "United States", storefront: 143441 },
  { code: "GB", name: "United Kingdom", storefront: 143444 },
  { code: "CA", name: "Canada", storefront: 143455 },
  { code: "AU", name: "Australia", storefront: 143460 },
  { code: "NZ", name: "New Zealand", storefront: 143461 },
  { code: "IE", name: "Ireland", storefront: 143449 },
  { code: "DE", name: "Germany", storefront: 143443 },
  { code: "FR", name: "France", storefront: 143442 },
  { code: "ES", name: "Spain", storefront: 143454 },
  { code: "IT", name: "Italy", storefront: 143450 },
  { code: "NL", name: "Netherlands", storefront: 143452 },
  { code: "BE", name: "Belgium", storefront: 143446 },
  { code: "CH", name: "Switzerland", storefront: 143459 },
  { code: "AT", name: "Austria", storefront: 143445 },
  { code: "PT", name: "Portugal", storefront: 143453 },
  { code: "SE", name: "Sweden", storefront: 143456 },
  { code: "NO", name: "Norway", storefront: 143457 },
  { code: "DK", name: "Denmark", storefront: 143458 },
  { code: "FI", name: "Finland", storefront: 143447 },
  { code: "PL", name: "Poland", storefront: 143478 },
  { code: "CZ", name: "Czechia", storefront: 143489 },
  { code: "GR", name: "Greece", storefront: 143448 },
  { code: "HU", name: "Hungary", storefront: 143482 },
  { code: "RO", name: "Romania", storefront: 143487 },
  { code: "UA", name: "Ukraine", storefront: 143492 },
  { code: "RU", name: "Russia", storefront: 143469 },
  { code: "TR", name: "Türkiye", storefront: 143480 },
  { code: "IL", name: "Israel", storefront: 143491 },
  { code: "SA", name: "Saudi Arabia", storefront: 143479 },
  { code: "AE", name: "United Arab Emirates", storefront: 143481 },
  { code: "EG", name: "Egypt", storefront: 143516 },
  { code: "NG", name: "Nigeria", storefront: 143561 },
  { code: "ZA", name: "South Africa", storefront: 143472 },
  { code: "IN", name: "India", storefront: 143467 },
  { code: "PK", name: "Pakistan", storefront: 143477 },
  { code: "JP", name: "Japan", storefront: 143462 },
  { code: "KR", name: "South Korea", storefront: 143466 },
  { code: "CN", name: "China", storefront: 143465 },
  { code: "HK", name: "Hong Kong", storefront: 143463 },
  { code: "TW", name: "Taiwan", storefront: 143470 },
  { code: "SG", name: "Singapore", storefront: 143464 },
  { code: "MY", name: "Malaysia", storefront: 143473 },
  { code: "TH", name: "Thailand", storefront: 143475 },
  { code: "ID", name: "Indonesia", storefront: 143476 },
  { code: "PH", name: "Philippines", storefront: 143474 },
  { code: "VN", name: "Vietnam", storefront: 143471 },
  { code: "BR", name: "Brazil", storefront: 143503 },
  { code: "MX", name: "Mexico", storefront: 143468 },
  { code: "AR", name: "Argentina", storefront: 143505 },
  { code: "CL", name: "Chile", storefront: 143483 },
  { code: "CO", name: "Colombia", storefront: 143501 },
] as const satisfies readonly Country[];

export type CountryCode = (typeof COUNTRIES)[number]["code"];

export const COUNTRY_CODES = COUNTRIES.map((c) => c.code) as [CountryCode, ...CountryCode[]];

export const DEFAULT_COUNTRY: CountryCode = "US";

export function getCountry(code: string): Country {
  return COUNTRIES.find((c) => c.code === code.toUpperCase()) ?? COUNTRIES[0];
}

/** Regional-indicator emoji flag for an ISO country code. */
export function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));
}
