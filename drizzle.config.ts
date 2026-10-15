import { defineConfig } from "drizzle-kit";

// Only used to generate migrations; the app applies them itself on startup.
export default defineConfig({
  schema: "./src/main/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  strict: true,
  verbose: true,
});
