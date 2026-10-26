import { webSearch, type ExaSearchConfig } from "@exalabs/ai-sdk";
import { tool, type Tool } from "ai";
import { z } from "zod";
import { within } from "./lead-runs";

export type SearchRow = { title: string | null; url: string; publishedDate?: string | null; text?: string; highlights?: string[]; subpages?: SearchRow[] };
export type SearchOutput = { requestId?: string; results: SearchRow[]; costDollars?: { total?: number } };

export type SearchOptions = {
  /** Results per search. The model only sends a query, so this is a hard limit. */
  maxResults?: number;
  textCharacters?: number;
  timeoutMs?: number;
};

const inputSchema = z.object({
  query: z.string().trim().min(1).max(500).describe("A specific search query."),
});

function trim(row: SearchRow): SearchRow {
  return {
    title: row.title ?? null,
    url: row.url,
    publishedDate: row.publishedDate ?? null,
    text: row.text,
    highlights: row.highlights,
    ...(row.subpages?.length ? { subpages: row.subpages.map(trim) } : {}),
  };
}

/** Exa search through @exalabs/ai-sdk, bounded in time and output size. */
function exaTool(description: string, config: ExaSearchConfig, { maxResults = 8, textCharacters = 2_000, timeoutMs = 60_000 }: SearchOptions) {
  const base = webSearch({
    type: "auto",
    numResults: maxResults,
    contents: { text: { maxCharacters: textCharacters }, highlights: { highlightsPerUrl: 3, numSentences: 3 } },
    ...config,
  });
  return tool({
    description,
    inputSchema,
    execute: async ({ query }, options): Promise<SearchOutput> => {
      const data = await within(Promise.resolve(base.execute!({ query }, options)) as Promise<SearchOutput>, timeoutMs);
      if (!data || !Array.isArray(data.results)) throw new Error("Exa returned an invalid search response.");
      return { requestId: data.requestId, results: data.results.map(trim), costDollars: data.costDollars };
    },
  });
}

/** General web search, for routes that need a single search tool. */
export function createWebSearchTool(options: SearchOptions = {}) {
  return exaTool(
    "Search the web with Exa for current information, companies, people and source evidence. Returns URLs with text and highlights. Cite returned URLs. This does not reveal or verify emails.",
    {},
    options,
  );
}

/**
 * The search tools a research agent gets. Exa filters are fixed per tool, so each kind of
 * search is its own tool, plus one limited to a company's own site when a domain is known.
 */
export function createSearchTools({ domain, ...options }: SearchOptions & { domain?: string } = {}) {
  const tools: Record<string, Tool<z.infer<typeof inputSchema>, SearchOutput>> = {
    web_search: createWebSearchTool(options),
    company_search: exaTool("Search company pages, such as company homepages and LinkedIn company pages, for what a company does, its size and location.", { category: "company" }, options),
    people_search: exaTool("Search LinkedIn profiles of people. Use it to find who holds a role at a company.", { category: "linkedin profile" }, options),
  };
  if (domain) {
    tools.site_search = exaTool(`Search only ${domain}, the company's own website, such as its about, team, pricing and careers pages.`, { includeDomains: [domain] }, options);
  }
  return tools;
}

export const SEARCH_TOOL_NAMES = new Set(["web_search", "company_search", "people_search", "site_search"]);
