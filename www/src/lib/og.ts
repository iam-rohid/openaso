import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

// 1200×630 Open Graph images, rendered at build time in the site's style.

// Paths are relative to the project root: this module is bundled before it runs.
const root = process.cwd();
const require = createRequire(path.join(root, "package.json"));
const font = (weight: 400 | 600) =>
  fs.readFile(require.resolve(`@fontsource/geist/files/geist-latin-${weight}-normal.woff`));
const icon = fs
  .readFile(path.join(root, "public/icon-512.png"))
  .then((b) => `data:image/png;base64,${b.toString("base64")}`);

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: unknown[]): Node => ({
  type,
  props: { style, children: children.length === 1 ? children[0] : children },
});

export async function renderOg({ title, subtitle }: { title: string; subtitle: string }) {
  const tree = h(
    "div",
    {
      // Satori adds padding to percentage sizes, so size the content box explicitly.
      width: 1200 - 160,
      height: 630 - 120,
      display: "flex",
      flexDirection: "column",
      padding: "64px 80px 56px",
      backgroundColor: "#07070a",
      backgroundImage:
        "radial-gradient(circle at 50% 135%, rgba(99,102,241,0.6) 0%, rgba(124,58,237,0.25) 35%, rgba(7,7,10,0) 62%)",
      color: "#ededf1",
      fontFamily: "Geist",
    },
    h(
      "div",
      { display: "flex", alignItems: "center", gap: 18 },
      {
        type: "img",
        props: { src: await icon, width: 64, height: 64, style: { borderRadius: 16 } },
      },
      h("div", { fontSize: 34, fontWeight: 600, letterSpacing: -0.5 }, "OpenASO"),
    ),
    h(
      "div",
      {
        display: "flex",
        flexDirection: "column",
        gap: 22,
        marginTop: "auto",
        marginBottom: "auto",
      },
      h(
        "div",
        { fontSize: 72, fontWeight: 600, letterSpacing: -2.5, lineHeight: 1.05, maxWidth: 1040 },
        title,
      ),
      h("div", { fontSize: 30, color: "#9898a6", lineHeight: 1.35, maxWidth: 940 }, subtitle),
    ),
    h(
      "div",
      { display: "flex", justifyContent: "space-between", fontSize: 22, color: "#62626e" },
      h("div", { display: "flex" }, "openaso.byteform.co"),
      h("div", { display: "flex" }, "Free · MIT licensed · macOS, Windows, Linux"),
    ),
  );

  const svg = await satori(tree as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Geist", data: await font(400), weight: 400, style: "normal" },
      { name: "Geist", data: await font(600), weight: 600, style: "normal" },
    ],
  });
  return new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
}

export const ogPages = {
  download: {
    title: "Download OpenASO",
    subtitle: "Free App Store keyword research and rank tracking for macOS, Windows and Linux.",
  },
  changelog: {
    title: "What's new in OpenASO",
    subtitle: "New features and fixes in every release.",
  },
  "astro-alternative": {
    title: "The free, open-source Astro alternative",
    subtitle: "An honest comparison of OpenASO and Astro for App Store Optimization.",
  },
} as const;
