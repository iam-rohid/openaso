import fs from "node:fs";
import type Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

/**
 * Applies pending migrations. When an existing database is about to change, it is
 * first copied to `<file>.bak` so a bad migration can't lose long-lived data.
 */
export function runMigrations(sqlite: Database.Database, file: string, migrationsFolder: string) {
  const migrations = readMigrationFiles({ migrationsFolder });
  const hasJournal = sqlite
    .prepare("select 1 from sqlite_master where type = 'table' and name = '__drizzle_migrations'")
    .get();

  if (hasJournal) {
    // Same comparison drizzle's migrator uses to decide what's pending.
    const { at } = sqlite.prepare("select max(created_at) as at from __drizzle_migrations").get() as {
      at: number | null;
    };
    if (migrations.some((m) => at == null || Number(at) < m.folderMillis)) {
      const backup = `${file}.bak`;
      fs.rmSync(backup, { force: true });
      sqlite.prepare("vacuum into ?").run(backup);
    }
  }

  migrate(drizzle(sqlite), { migrationsFolder });
}
