// @ts-check
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { SITE_URL } from "./src/consts";

export default defineConfig({
  site: SITE_URL,
  output: "static",
  // /download, not /download/: pages build to download.html, which Cloudflare serves at
  // the slash-less URL, so links, canonicals and the sitemap all agree without redirects.
  trailingSlash: "never",
  // Inline CSS: it's small, and saves a render-blocking request.
  build: { format: "file", inlineStylesheets: "always" },
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
    // Mirrors the /ingest PostHog proxy in worker/index.ts for `astro dev`.
    server: {
      proxy: {
        "/ingest/static": {
          target: "https://us-assets.i.posthog.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ingest/, ""),
        },
        "/ingest/array": {
          target: "https://us-assets.i.posthog.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ingest/, ""),
        },
        "/ingest": {
          target: "https://us.i.posthog.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ingest/, ""),
        },
      },
    },
  },
});
