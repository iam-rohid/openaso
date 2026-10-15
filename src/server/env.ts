import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_PATH: z.string().min(1).default(".data/openaso.db"),
  KEYWORD_CACHE_TTL_HOURS: z.coerce.number().positive().default(24),
});

export const env = envSchema.parse(process.env);
