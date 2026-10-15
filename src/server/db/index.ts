import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { env } from "@/server/env";
import { openDatabase } from "./open";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { sqlite?: Database.Database };

// Reuse the connection across hot reloads in development.
const sqlite = globalForDb.sqlite ?? openDatabase(env.DATABASE_PATH);
if (process.env.NODE_ENV !== "production") globalForDb.sqlite = sqlite;

export const db = drizzle(sqlite, { schema });
export type Db = typeof db;
export { schema };
