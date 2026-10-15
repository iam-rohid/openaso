import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Hide the floating Next.js badge; compile and runtime errors still show.
  devIndicators: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.mzstatic.com" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
