/**
 * Runs once when the Next.js server boots: applies pending Drizzle migrations so
 * `pnpm dev` and the Docker image both work against a fresh database.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runMigrations } = await import("./server/db/migrate");
  await runMigrations();
}
