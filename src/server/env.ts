import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  KEYWORD_CACHE_TTL_HOURS: z.coerce.number().positive().default(24),
});

export const env = envSchema.parse(process.env);
