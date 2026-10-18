import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, eq } from "drizzle-orm";
import { BrowserWindow } from "electron";
import { z } from "zod";
import { createCaller } from "@main/api/root";
import { createTRPCContext, describeAppleError } from "@main/api/trpc";
import { AppleApiError } from "@main/apple/http";
import { db } from "@main/db";
import { keywords } from "@main/db/schema";
import { normalizeTerm } from "@main/services/keywords";
import { isTemporaryAppId, parseAppId } from "@shared/apps";
import { COUNTRY_CODES, DEFAULT_COUNTRY, type CountryCode } from "@shared/countries";
import { DATA_CHANGED_CHANNEL } from "@shared/ipc";
import { DEFAULT_TREND_WINDOW, TREND_WINDOWS } from "@shared/trends";

/** What the read, write and prompt modules share: arguments, lookups and result shapes. */

export type { McpServer };

/**
 * The same tRPC router the UI calls, so tools get its validation, preconditions and Apple
 * error messages. Created on first use: the router imports the server, which imports this.
 */
export let caller: ReturnType<typeof createCaller>;
export function initCaller() {
  caller ??= createCaller(createTRPCContext);
}

export const appArg = z
  .string()
  .min(1)
  .describe("Numeric App Store id, apps.apple.com link, or the name of a tracked app");
export const countryArg = z
  .string()
  .optional()
  .describe("Two-letter App Store storefront, like US or DE. Defaults to the app's storefront, else US");
export const termArg = z.string().trim().min(1).max(100);
export const windowArg = z
  .enum(TREND_WINDOWS)
  .default(DEFAULT_TREND_WINDOW)
  .describe("How far back position changes compare: 1d, 7d or 30d");

export const READ = { readOnlyHint: true, openWorldHint: false } as const;
/** Looks things up from Apple; only the local cache changes. */
export const RESEARCH = { readOnlyHint: true, openWorldHint: true } as const;
/** Adds to or edits what the user tracks; nothing is lost. */
export const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
export const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false } as const;

export function errorMessage(err: unknown) {
  if (err instanceof AppleApiError) return describeAppleError(err).message;
  return err instanceof Error ? err.message : String(err);
}

/** Runs a tool, answering with compact JSON or a readable error. */
export async function run(fn: () => Promise<unknown>) {
  try {
    return { content: [{ type: "text" as const, text: JSON.stringify(await fn()) }] };
  } catch (err) {
    return { isError: true, content: [{ type: "text" as const, text: errorMessage(err) }] };
  }
}

/** Tells the window to refetch what it shows. */
function notifyDataChanged() {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(DATA_CHANGED_CHANNEL);
}

/** `run` for tools that change data: the window updates once they succeed. */
export async function write(fn: () => Promise<unknown>) {
  const result = await run(fn);
  if (!("isError" in result)) notifyDataChanged();
  return result;
}

export function toCountry(code: string | undefined, fallback: string = DEFAULT_COUNTRY): CountryCode {
  const upper = (code?.trim() || fallback).toUpperCase();
  const normalized = upper === "UK" ? "GB" : upper;
  if (!(COUNTRY_CODES as readonly string[]).includes(normalized)) {
    throw new Error(`Unknown storefront "${code}". Use one of: ${COUNTRY_CODES.join(", ")}.`);
  }
  return normalized as CountryCode;
}

export type ResolvedApp = { id: string; name: string | null; tracked: boolean; country: CountryCode };

/** Finds an app by id, App Store link or tracked app name, with the storefront to use for it. */
export async function resolveApp(ref: string, country?: string): Promise<ResolvedApp> {
  const tracked = await caller.apps.tracked();
  const trimmed = ref.trim();
  const id = parseAppId(trimmed) ?? (isTemporaryAppId(trimmed) ? trimmed : null);
  let match: (typeof tracked)[number] | undefined;
  if (id) {
    match = tracked.find((a) => a.id === id);
    if (!match) return { id, name: null, tracked: false, country: toCountry(country) };
  } else {
    const name = trimmed.toLowerCase();
    const exact = tracked.filter((a) => a.name.toLowerCase() === name);
    const matches = exact.length > 0 ? exact : tracked.filter((a) => a.name.toLowerCase().includes(name));
    if (matches.length === 0) {
      throw new Error(
        `No tracked app matches "${ref}". Use list_apps to see tracked apps, or search_app_store and pass the app's numeric id.`,
      );
    }
    if (matches.length > 1) {
      const names = matches.map((a) => `${a.name} (${a.id})`).join(", ");
      throw new Error(`"${ref}" matches several tracked apps: ${names}. Pass the id instead.`);
    }
    match = matches[0];
  }
  return { id: match.id, name: match.name, tracked: true, country: toCountry(country, match.country) };
}


export const isoDate = (date: Date | null) => date?.toISOString() ?? null;

export async function findKeyword(term: string, country: CountryCode) {
  const [row] = await db
    .select()
    .from(keywords)
    .where(and(eq(keywords.term, normalizeTerm(term)), eq(keywords.country, country)))
    .limit(1);
  return row;
}

/** Throws unless the user tracks the app, pointing at the tools that add it. */
export function requireTracked(app: ResolvedApp) {
  if (app.tracked) return;
  throw new Error(
    `${app.name ?? `App ${app.id}`} isn't tracked. Use track_app first, or create_unreleased_app for an app that isn't on the App Store yet.`,
  );
}

/** A folder's id from its name (any case). */
export async function findFolder(name: string) {
  const folders = await caller.folders.list();
  const folder = folders.find((f) => f.name.toLowerCase() === name.trim().toLowerCase());
  if (!folder) {
    const names = folders.map((f) => f.name).join(", ");
    throw new Error(`There's no folder named "${name}".${names ? ` Folders: ${names}.` : " There are no folders."}`);
  }
  return folder;
}
