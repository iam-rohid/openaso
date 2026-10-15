import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/** Opens (creating if needed) the SQLite file with the pragmas the schema relies on. */
export function openDatabase(file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  // Off by default in SQLite; the cascades and `set null` on folders depend on it.
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return sqlite;
}
