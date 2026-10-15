import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import { AppleApiError } from "@/server/apple/http";
import { db } from "@/server/db";

export async function createTRPCContext(opts: { headers: Headers }) {
  return { db, ...opts };
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof z.ZodError ? z.flattenError(error.cause) : null,
      },
    };
  },
});

/** Turn upstream Apple failures into readable tRPC errors. */
const appleErrors = t.middleware(async ({ next }) => {
  const result = await next();
  if (!result.ok && result.error.cause instanceof AppleApiError) {
    const status = result.error.cause.status;
    throw new TRPCError({
      code: status === 403 || status === 429 ? "TOO_MANY_REQUESTS" : "BAD_GATEWAY",
      message:
        status === 403 || status === 429
          ? "Apple is rate limiting requests right now. Try again in a minute."
          : "Couldn't reach the App Store. Check your connection and try again.",
      cause: result.error.cause,
    });
  }
  return result;
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure.use(appleErrors);
