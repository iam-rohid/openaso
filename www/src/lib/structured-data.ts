import { REPO_URL, SITE_NAME, SITE_URL } from "../consts";
import { getLatestRelease } from "./github";

/** schema.org SoftwareApplication for OpenASO, with the latest version. */
export async function softwareApplication() {
  const release = await getLatestRelease();
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    description:
      "Free, open-source App Store keyword research and rank tracking: rankings, keyword popularity and difficulty, suggestions and competitor keywords.",
    url: SITE_URL,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "macOS, Windows, Linux",
    softwareVersion: release.tag.replace(/^v/, ""),
    datePublished: release.publishedAt.toISOString().slice(0, 10),
    downloadUrl: `${SITE_URL}/download`,
    license: "https://opensource.org/licenses/MIT",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    image: `${SITE_URL}/icon-512.png`,
    sameAs: [REPO_URL],
  };
}
