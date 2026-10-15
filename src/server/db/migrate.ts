import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export async function runMigrations() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  // Dedicated single connection, closed afterwards.
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), {
      migrationsFolder: process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle"),
    });
    console.log("✓ Database migrations applied");
  } catch (err) {
    console.error("✗ Failed to apply database migrations. Is Postgres running? (docker compose up -d db)");
    throw err;
  } finally {
    await client.end();
  }
}
