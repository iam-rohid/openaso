import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

const shared = { "@shared": resolve("src/shared") };

export default defineConfig({
  main: {
    resolve: { alias: { ...shared, "@main": resolve("src/main") } },
    build: {
      // Bundle everything except the native module, which electron-builder rebuilds per platform.
      externalizeDeps: false,
      rolldownOptions: { external: ["better-sqlite3"] },
    },
  },
  preload: {
    resolve: { alias: shared },
  },
  renderer: {
    resolve: { alias: { ...shared, "@main": resolve("src/main"), "@": resolve("src/renderer/src") } },
    plugins: [
      tanstackRouter({
        target: "react",
        routesDirectory: resolve("src/renderer/src/routes"),
        generatedRouteTree: resolve("src/renderer/src/routeTree.gen.ts"),
      }),
      react(),
      tailwindcss(),
    ],
  },
});
