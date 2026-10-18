import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@main/db";
import { appKeywords } from "@main/db/schema";
import { normalizeTerm } from "@main/services/keywords";
import { isTemporaryAppId, parseAppId, TEMPORARY_APP_NAME_MAX } from "@shared/apps";
import {
  appArg,
  caller,
  countryArg,
  DESTRUCTIVE,
  findFolder,
  findKeyword,
  type McpServer,
  requireTracked,
  resolveApp,
  termArg,
  toCountry,
  write,
  WRITE,
} from "./common";

/** At most this many keywords refetched per refresh_app_keywords call; the rest wait for the next. */
const MAX_AGENT_REFRESH = 200;

const folderArg = z.string().trim().min(1).optional().describe("Put the app in this existing folder (by name)");

export function registerWriteTools(server: McpServer) {
  server.registerTool(
    "track_app",
    {
      title: "Track an app",
      description:
        "Adds an App Store app to the user's tracked apps (My Apps), so keywords can be tracked for it. Find its id with search_app_store. For an app that isn't on the App Store yet, use create_unreleased_app.",
      inputSchema: {
        app: appArg.describe("Numeric App Store id or apps.apple.com link"),
        country: countryArg.describe("The storefront to track it in, like US or DE. Defaults to US"),
        folder: folderArg,
      },
      annotations: WRITE,
    },
    ({ app, country, folder }) =>
      write(async () => {
        const resolved = await resolveApp(app, country);
        if (resolved.tracked) {
          return { alreadyTracked: true, app: { id: resolved.id, name: resolved.name }, country: resolved.country };
        }
        const folderId = folder ? (await findFolder(folder)).id : undefined;
        const tracked = await caller.apps.track({ id: resolved.id, country: resolved.country, folderId });
        return { tracked: true, app: { id: tracked.id, name: tracked.name }, country: resolved.country };
      }),
  );

  server.registerTool(
    "create_unreleased_app",
    {
      title: "Create an unreleased app",
      description:
        "Tracks a placeholder for an app that isn't on the App Store yet, so keywords can be researched and tracked for it before launch. Link it to its real listing with link_unreleased_app once it's live.",
      inputSchema: {
        name: z.string().trim().min(1).max(TEMPORARY_APP_NAME_MAX),
        country: countryArg.describe("The storefront to track it in, like US or DE. Defaults to US"),
        folder: folderArg,
      },
      annotations: { ...WRITE, idempotentHint: false, openWorldHint: false },
    },
    ({ name, country, folder }) =>
      write(async () => {
        const storefront = toCountry(country);
        const folderId = folder ? (await findFolder(folder)).id : undefined;
        const app = await caller.apps.createTemporary({ name, country: storefront, folderId });
        return { app: { id: app.id, name: app.name }, country: storefront };
      }),
  );

  server.registerTool(
    "link_unreleased_app",
    {
      title: "Link an unreleased app",
      description:
        "Replaces an unreleased app placeholder with its App Store listing once it's live. Its tracked keywords and notes move to the real app, and the placeholder is removed.",
      inputSchema: {
        app: appArg.describe("The unreleased app: its id or name"),
        target: z.string().min(1).describe("The live app's numeric App Store id or apps.apple.com link"),
        country: countryArg,
      },
      annotations: { ...WRITE, openWorldHint: true },
    },
    ({ app, target, country }) =>
      write(async () => {
        const resolved = await resolveApp(app, country);
        if (!isTemporaryAppId(resolved.id)) throw new Error(`${resolved.name ?? resolved.id} isn't an unreleased app.`);
        const targetId = parseAppId(target);
        if (!targetId) throw new Error(`"${target}" isn't an App Store id or link. Find it with search_app_store.`);
        const result = await caller.apps.linkTemporary({ id: resolved.id, targetId, country: resolved.country });
        return {
          app: { id: result.app.id, name: result.app.name },
          movedKeywords: result.moved,
          mergedIntoTrackedApp: result.merged,
        };
      }),
  );

  server.registerTool(
    "add_keywords",
    {
      title: "Track keywords",
      description:
        "Tracks keywords for a tracked app in one storefront (up to 100 at a time; already tracked ones are skipped). Each is looked up if it isn't cached, and from then on gets a ranking point every day. Returns the app's position for each.",
      inputSchema: { app: appArg, terms: z.array(termArg).min(1).max(100), country: countryArg },
      annotations: WRITE,
    },
    ({ app, terms, country }) =>
      write(async () => {
        const resolved = await resolveApp(app, country);
        requireTracked(resolved);
        const { added, failed } = await caller.keywords.add({ appId: resolved.id, country: resolved.country, terms });
        const wanted = new Set(terms.map(normalizeTerm));
        const rows = await caller.keywords.list({ appId: resolved.id, country: resolved.country });
        return {
          app: { id: resolved.id, name: resolved.name },
          country: resolved.country,
          added,
          ...(failed.length > 0 && { failed }),
          keywords: rows
            .filter((k) => wanted.has(k.term))
            .map((k) => ({ term: k.term, position: k.position, popularity: k.popularity, difficulty: k.difficulty })),
        };
      }),
  );

  server.registerTool(
    "set_keyword_note",
    {
      title: "Set a keyword note",
      description: "Sets the note on a keyword a tracked app tracks, shown in the app's keyword table. An empty note clears it.",
      inputSchema: { app: appArg, term: termArg, note: z.string().max(500), country: countryArg },
      annotations: { ...WRITE, openWorldHint: false },
    },
    ({ app, term, note, country }) =>
      write(async () => {
        const resolved = await resolveApp(app, country);
        requireTracked(resolved);
        const keyword = await findKeyword(term, resolved.country);
        const [link] = keyword
          ? await db
              .select()
              .from(appKeywords)
              .where(and(eq(appKeywords.appId, resolved.id), eq(appKeywords.keywordId, keyword.id)))
              .limit(1)
          : [];
        if (!keyword || !link) {
          throw new Error(`${resolved.name} doesn't track "${term}" in ${resolved.country}. Track it with add_keywords first.`);
        }
        await caller.keywords.updateNotes({ appId: resolved.id, keywordId: keyword.id, notes: note });
        return { term: keyword.term, country: resolved.country, note: note.trim() || null };
      }),
  );

  server.registerTool(
    "refresh_app_keywords",
    {
      title: "Refresh an app's keywords",
      description: `Refetches a tracked app's keywords from Apple: only those older than 24 hours unless all is true, and at most ${MAX_AGENT_REFRESH} per call. Tracked keywords are refreshed daily anyway, so this is rarely needed.`,
      inputSchema: {
        app: appArg,
        country: countryArg,
        all: z.boolean().default(false).describe("Also refetch keywords fetched in the last 24 hours"),
      },
      annotations: WRITE,
    },
    ({ app, country, all }) =>
      write(async () => {
        const resolved = await resolveApp(app, country);
        requireTracked(resolved);
        const rows = await caller.keywords.list({ appId: resolved.id, country: resolved.country });
        const due = rows.filter((k) => all || k.stale);
        const batch = due.slice(0, MAX_AGENT_REFRESH);
        const { refreshed, failed } =
          batch.length > 0 ? await caller.keywords.refresh({ keywordIds: batch.map((k) => k.id) }) : { refreshed: 0, failed: 0 };
        return {
          app: { id: resolved.id, name: resolved.name },
          country: resolved.country,
          refreshed,
          failed,
          remaining: due.length - batch.length,
          ...(failed > 0 && { note: "Some keywords failed to refresh; Apple may be rate limiting. Try again in a few minutes." }),
        };
      }),
  );
}

/** Only registered when the user allows agents to remove data in Settings. */
export function registerRemoveTools(server: McpServer) {
  server.registerTool(
    "untrack_app",
    {
      title: "Untrack an app",
      description:
        "Removes an app from the user's tracked apps. Its keyword data stays cached, but an unreleased app placeholder is deleted along with its tracked keywords and notes.",
      inputSchema: { app: appArg },
      annotations: DESTRUCTIVE,
    },
    ({ app }) =>
      write(async () => {
        const resolved = await resolveApp(app);
        requireTracked(resolved);
        await caller.apps.untrack({ id: resolved.id });
        return { untracked: { id: resolved.id, name: resolved.name }, deleted: isTemporaryAppId(resolved.id) };
      }),
  );

  server.registerTool(
    "remove_keywords",
    {
      title: "Stop tracking keywords",
      description: "Stops tracking keywords for a tracked app in one storefront, along with their notes.",
      inputSchema: { app: appArg, terms: z.array(termArg).min(1).max(500), country: countryArg },
      annotations: DESTRUCTIVE,
    },
    ({ app, terms, country }) =>
      write(async () => {
        const resolved = await resolveApp(app, country);
        requireTracked(resolved);
        const wanted = new Set(terms.map(normalizeTerm));
        const rows = await caller.keywords.list({ appId: resolved.id, country: resolved.country });
        const matched = rows.filter((k) => wanted.has(k.term));
        if (matched.length > 0) {
          await caller.keywords.remove({ appId: resolved.id, keywordIds: matched.map((k) => k.id) });
        }
        const removed = new Set(matched.map((k) => k.term));
        const notTracked = [...wanted].filter((t) => !removed.has(t));
        return {
          app: { id: resolved.id, name: resolved.name },
          country: resolved.country,
          removed: [...removed],
          ...(notTracked.length > 0 && { notTracked }),
        };
      }),
  );

  server.registerTool(
    "delete_folder",
    {
      title: "Delete a folder",
      description: "Deletes a folder of tracked apps. The apps in it stay tracked and move to the top level.",
      inputSchema: { folder: z.string().trim().min(1).describe("The folder's name") },
      annotations: DESTRUCTIVE,
    },
    ({ folder }) =>
      write(async () => {
        const found = await findFolder(folder);
        const { movedCount } = await caller.folders.delete({ id: found.id });
        return { deleted: found.name, appsMovedToTopLevel: movedCount };
      }),
  );
}
