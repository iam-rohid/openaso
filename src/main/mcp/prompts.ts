import { z } from "zod";
import type { McpServer } from "./common";

/**
 * Ready-made research workflows. Clients show them as slash commands (Claude Code) or in
 * an attachment menu (Claude Desktop); each expands into instructions that use the tools.
 */

const appArg = z.string().describe("The app: its name in OpenASO, App Store id or link");
const countryArg = z.string().optional().describe("Two-letter App Store storefront, like US. Defaults to the app's");

const storefront = (country: string | undefined) => (country ? ` in the ${country.toUpperCase()} storefront` : "");

const userMessage = (text: string) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text } }] });

export function registerPrompts(server: McpServer) {
  server.registerPrompt(
    "keyword_research",
    {
      title: "Keyword research",
      description: "Find, score and shortlist new keywords for an app, then offer to track the best ones.",
      argsSchema: { app: appArg, country: countryArg },
    },
    ({ app, country }) =>
      userMessage(`Do keyword research for ${app}${storefront(country)} using the OpenASO tools.

1. Read the app's listing with get_app and its current keywords with get_app_keywords, so you know what it's about and what it already tracks.
2. Gather candidates with get_keyword_suggestions (also with a few seeds from the app's core features) and get_autocomplete.
3. Score the most promising 30–50 in one or two explore_keywords calls, passing the app so you see where it already ranks.
4. Shortlist about 15 keywords that balance popularity against difficulty and fit the app. Favor terms where it already ranks outside the top 10 or where difficulty is low for the popularity.
5. Present the shortlist as a table (term, popularity, difficulty, current position, why), then ask whether to track them with add_keywords.`),
  );

  server.registerPrompt(
    "competitor_gap",
    {
      title: "Competitor keyword gap",
      description: "Find keywords the app's top competitors rank for that it doesn't.",
      argsSchema: { app: appArg, country: countryArg },
    },
    ({ app, country }) =>
      userMessage(`Find the keyword gap between ${app} and its competitors${storefront(country)} using the OpenASO tools.

1. Get the app's tracked keywords with get_app_keywords, then use get_keyword_ranking on its 3–5 most popular keywords to see who ranks above it.
2. Pick the 3–5 competitors that show up most, and run discover_app_keywords on each to see what they rank for.
3. Collect keywords where competitors rank in the top 20 and the app ranks worse or not at all. Score any you lack data for with explore_keywords, passing the app.
4. Present the gaps as a table (term, popularity, difficulty, best competitor and its position, the app's position), most valuable first, with a sentence on what the competitors' titles and subtitles do differently.
5. Offer to track the best gaps with add_keywords.`),
  );

  server.registerPrompt(
    "ranking_report",
    {
      title: "Ranking report",
      description: "Summarize how the app's keyword rankings moved and what to do about it.",
      argsSchema: {
        app: appArg,
        country: countryArg,
        window: z.enum(["1d", "7d", "30d"]).optional().describe("How far back to compare. Defaults to 7d"),
      },
    },
    ({ app, country, window }) =>
      userMessage(`Write a ranking report for ${app}${storefront(country)} over the last ${window ?? "7d"} using the OpenASO tools.

1. Get the overview with get_ranking_summary (window ${window ?? "7d"}).
2. Get the keyword detail with get_app_keywords (same window, includeHistory true) to look at the biggest movers.
3. Report: the headline counts and how they changed, the biggest gains and drops weighted by popularity (a drop on a popular keyword matters more), keywords that entered or left the results, and any pattern (for example, several related terms moving together).
4. End with two or three concrete suggestions, such as keywords to put in the title or subtitle, or ones to stop tracking. Keep it short enough to read in a minute.`),
  );

  server.registerPrompt(
    "new_app_keywords",
    {
      title: "Keywords for a new app",
      description: "Research keywords for an app that isn't on the App Store yet, from its description to a tracked list.",
      argsSchema: {
        name: z.string().describe("The app's working name"),
        description: z.string().describe("What the app does and who it's for"),
        country: countryArg,
      },
    },
    ({ name, description, country }) =>
      userMessage(`I'm building an app called "${name}" that isn't on the App Store yet${storefront(country)}. Here's what it does:

${description}

Using the OpenASO tools:
1. Brainstorm 40–60 search terms people would use to find an app like this: features, problems it solves, audiences, and category terms. Expand the best seeds with get_autocomplete.
2. Score them in batches with explore_keywords. Look at get_keyword_ranking for the most popular few to see which apps I'd compete with.
3. Recommend about 20 keywords, split into "go for it now" (decent popularity, low difficulty) and "longer term" (popular but crowded), with a suggested title and subtitle that use the strongest terms.
4. Ask whether to set it up in OpenASO: create_unreleased_app with the name, then add_keywords with the recommended terms.`),
  );
}
