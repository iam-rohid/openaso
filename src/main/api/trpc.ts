import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import { AppleApiError } from "@main/apple/http";
import { db } from "@main/db";

export async function createTRPCContext() {
  return { db };
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

/** A readable message for an upstream Apple failure, and whether Apple is throttling us. */
export function describeAppleError(error: AppleApiError) {
  const throttled = error.status === 403 || error.status === 429;
  return {
    throttled,
    message: throttled
      ? "Apple is rate limiting requests right now. Try again in a minute."
      : "Couldn't reach the App Store. Check your connection and try again.",
  };
}

/** Turn upstream Apple failures into readable tRPC errors. */
const appleErrors = t.middleware(async ({ next }) => {
  const result = await next();
  if (!result.ok && result.error.cause instanceof AppleApiError) {
    const { throttled, message } = describeAppleError(result.error.cause);
    throw new TRPCError({
      code: throttled ? "TOO_MANY_REQUESTS" : "BAD_GATEWAY",
      message,
      cause: result.error.cause,
    });
  }
  return result;
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure.use(appleErrors);
