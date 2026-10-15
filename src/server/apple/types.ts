/** Normalised app metadata shared by every Apple endpoint we consume. */
export type AppleApp = {
  id: string;
  name: string;
  /** null when the source doesn't carry subtitles. */
  subtitle: string | null;
  developer: string;
  developerId: string | null;
  bundleId: string | null;
  iconUrl: string | null;
  genre: string | null;
  price: number;
  formattedPrice: string | null;
  rating: number | null;
  ratingCount: number;
  description: string | null;
  storeUrl: string | null;
  releaseDate: Date | null;
  updatedDate: Date | null;
  version: string | null;
};
