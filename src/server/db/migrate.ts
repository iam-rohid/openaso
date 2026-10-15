import path from "node:path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { openDatabase } from "./open";

export function runMigrations() {
  const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), ".data", "openaso.db");

  // Dedicated connection, closed afterwards.
  const sqlite = openDatabase(file);
  try {
    migrate(drizzle(sqlite), {
      migrationsFolder: process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle"),
    });
    console.log(`✓ Database migrations applied (${file})`);
  } catch (err) {
    console.error("✗ Failed to apply database migrations");
    throw err;
  } finally {
    sqlite.close();
  }
}
