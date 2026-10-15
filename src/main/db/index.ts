import { drizzle } from "drizzle-orm/better-sqlite3";
import { runMigrations } from "./migrate";
import { openDatabase } from "./open";
import * as schema from "./schema";

const connect = (sqlite: ReturnType<typeof openDatabase>) => drizzle(sqlite, { schema });
export type Db = ReturnType<typeof connect>;

/** Set by `initDatabase` at startup, before any IPC request is handled. */
export let db: Db;

/** Opens the database file, migrates it, and makes it available as `db`. */
export function initDatabase(file: string, migrationsFolder: string) {
  const sqlite = openDatabase(file);
  try {
    runMigrations(sqlite, file, migrationsFolder);
  } catch (err) {
    sqlite.close();
    throw err;
  }
  db = connect(sqlite);
  return sqlite;
}

export { schema };
