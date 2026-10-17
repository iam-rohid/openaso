import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@main/api/trpc";
import { appIdInput, countryInput } from "@main/api/inputs";
import {
  getRankUpdateStatus,
  setRankUpdateFocus,
  setRankUpdatesEnabled,
} from "@main/services/rank-updates";

/** The daily background ranking refresh. */
export const rankUpdatesRouter = createTRPCRouter({
  status: publicProcedure.query(() => getRankUpdateStatus()),

  setEnabled: publicProcedure.input(z.object({ enabled: z.boolean() })).mutation(({ input }) => {
    setRankUpdatesEnabled(input.enabled);
    return getRankUpdateStatus();
  }),

  /** The app page in view, so its keywords are refreshed first. */
  setFocus: publicProcedure
    .input(z.object({ appId: appIdInput, country: countryInput }).nullable())
    .mutation(({ input }) => setRankUpdateFocus(input)),
});
