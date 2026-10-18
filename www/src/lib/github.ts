import { REPO } from "../consts";

// Build-time GitHub data. The site is rebuilt when a release is published and once a day
// (see .github/workflows/www-rebuild.yml), which keeps the version, links and stars fresh.

export type Asset = { name: string; size: number; url: string; digest: string | null };
export type Release = {
  tag: string;
  name: string;
  body: string;
  publishedAt: Date;
  url: string;
  assets: Asset[];
};

type ApiRelease = {
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  published_at: string;
  html_url: string;
  assets: { name: string; size: number; browser_download_url: string; digest?: string | null }[];
};

async function api<T>(path: string): Promise<T> {
  const token = import.meta.env.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${path}: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

const toRelease = (r: ApiRelease): Release => ({
  tag: r.tag_name,
  name: r.name || r.tag_name,
  body: r.body ?? "",
  publishedAt: new Date(r.published_at),
  url: r.html_url,
  assets: r.assets.map((a) => ({
    name: a.name,
    size: a.size,
    url: a.browser_download_url,
    digest: a.digest ?? null,
  })),
});

let releases: Promise<Release[]> | undefined;
let stars: Promise<number> | undefined;

/**
 * Published, non-prerelease releases, newest first. Throws so a failed fetch fails the
 * build instead of deploying a site without download links.
 */
export function getReleases() {
  releases ??= api<ApiRelease[]>("/releases?per_page=100").then((list) =>
    list.filter((r) => !r.draft && !r.prerelease).map(toRelease),
  );
  return releases;
}

export async function getLatestRelease() {
  const [latest] = await getReleases();
  if (!latest) throw new Error("No published release found");
  return latest;
}

/** Star count, or 0 when GitHub can't be reached: stars aren't worth failing a build over. */
export function getStars() {
  stars ??= api<{ stargazers_count: number }>("")
    .then((r) => r.stargazers_count)
    .catch((err) => {
      console.warn(`Couldn't fetch GitHub stars: ${err}`);
      return 0;
    });
  return stars;
}
