import { getLatestRelease, type Asset } from "./github";

export type DownloadId = "mac-arm64" | "mac-x64" | "windows" | "appimage" | "deb";
export type Os = "mac" | "windows" | "linux";

export type Download = {
  id: DownloadId;
  os: Os;
  label: string;
  /** Tested against the asset names electron-builder produces, e.g. OpenASO-0.5.0-mac-arm64.dmg. */
  match: RegExp;
  asset: Asset;
};

const DOWNLOADS: Omit<Download, "asset">[] = [
  { id: "mac-arm64", os: "mac", label: "macOS (Apple Silicon)", match: /-mac-arm64\.dmg$/ },
  { id: "mac-x64", os: "mac", label: "macOS (Intel)", match: /-mac-x64\.dmg$/ },
  { id: "windows", os: "windows", label: "Windows", match: /-windows-setup\.exe$/ },
  { id: "appimage", os: "linux", label: "Linux (AppImage)", match: /\.AppImage$/ },
  { id: "deb", os: "linux", label: "Linux (.deb)", match: /\.deb$/ },
];

/** Direct installer links for the latest release, keyed by id. */
export async function getDownloads() {
  const release = await getLatestRelease();
  const byId = {} as Record<DownloadId, Download>;
  for (const d of DOWNLOADS) {
    const asset = release.assets.find((a) => d.match.test(a.name));
    if (!asset) throw new Error(`${release.tag} has no ${d.label} installer`);
    byId[d.id] = { ...d, asset };
  }
  return { release, downloads: byId };
}
