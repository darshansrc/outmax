import { tool, type JSONValue, type Tool } from "ai";
import { z } from "zod";

export type SearchRow = { title: string | null; url: string; publishedDate?: string | null; text?: string; highlights?: string[]; subpages?: SearchRow[] };
export type SearchOutput = { requestId?: string; results: SearchRow[]; costDollars?: { total?: number } };

export type SearchOptions = {
  /** Results per search. The model only sends a query, so this is a hard limit. */
  maxResults?: number;
  textCharacters?: number;
  timeoutMs?: number;
  /**
   * Show the model only titles, urls, dates and highlights. The full output, page text
   * included, still reaches the caller's step callbacks for quote checks.
   */
  lean?: boolean;
};

/**
 * Fixed request settings for one tool. `lite` is cheaper and serves only cached pages,
 * so small company websites use `auto`, which can fetch pages that aren't cached.
 */
type ExaSearchConfig = {
  type?: "auto" | "lite";
  category?: "company" | "people" | "news";
  includeDomains?: string[];
  excludeDomains?: string[];
};

const EXA_URL = "https://api.exa.ai";
const HIGHLIGHT_CHARACTERS = 600;
const MAX_DOMAIN_FILTERS = 100;

async function exaRequest<T>(path: string, body: Record<string, unknown>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  const apiKey = process.env.EXA_API_KEY?.trim();
  if (!apiKey) throw new Error("EXA_API_KEY is not configured.");
  const timeout = AbortSignal.timeout(timeoutMs);
  const response = await fetch(`${EXA_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  const data = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok || !data) throw new Error(`Exa ${path} failed (HTTP ${response.status}): ${data?.error ?? "no response body"}`.slice(0, 400));
  return data;
}

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

function leanRow(row: SearchRow): Record<string, unknown> {
  return {
    title: row.title,
    url: row.url,
    ...(row.publishedDate ? { publishedDate: row.publishedDate } : {}),
    highlights: (row.highlights ?? []).map((text) => text.slice(0, HIGHLIGHT_CHARACTERS)),
    ...(row.subpages?.length ? { subpages: row.subpages.map(leanRow) } : {}),
  };
}

function cleanDomains(domains: string[] | undefined) {
  const list = [...new Set((domains ?? []).map((domain) => domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "")).filter(Boolean))];
  return list.length ? list.slice(0, MAX_DOMAIN_FILTERS) : undefined;
}

const queryInput = z.object({
  query: z.string().trim().min(1).max(500).describe("A specific search query in natural language. Don't use site: operators."),
});

const filteredInput = queryInput.extend({
  include_domains: z.array(z.string().trim().min(3).max(200)).max(10).optional()
    .describe("Only return results from these domains or path prefixes, such as \"jobs.ashbyhq.com/acme\"."),
  start_published_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Only return pages published on or after this date (YYYY-MM-DD). Use it for recent news, launches, funding or job posts."),
});

type FilteredInput = z.infer<typeof filteredInput>;

function exaTool(description: string, config: ExaSearchConfig, options: SearchOptions, filters = false) {
  const { maxResults = 8, textCharacters = 2_000, timeoutMs = 60_000, lean = false } = options;
  const run = async (input: FilteredInput, signal?: AbortSignal): Promise<SearchOutput> => {
    const data = await exaRequest<SearchOutput>("/search", {
      query: input.query,
      type: config.type ?? "auto",
      numResults: maxResults,
      ...(config.category ? { category: config.category } : {}),
      ...(cleanDomains(input.include_domains ?? config.includeDomains) ? { includeDomains: cleanDomains(input.include_domains ?? config.includeDomains) } : {}),
      ...(cleanDomains(config.excludeDomains) ? { excludeDomains: cleanDomains(config.excludeDomains) } : {}),
      ...(input.start_published_date ? { startPublishedDate: `${input.start_published_date}T00:00:00.000Z` } : {}),
      contents: { text: { maxCharacters: textCharacters }, highlights: { maxCharacters: HIGHLIGHT_CHARACTERS } },
    }, timeoutMs, signal);
    if (!Array.isArray(data.results)) throw new Error("Exa returned an invalid search response.");
    return { requestId: data.requestId, results: data.results.map(trim), costDollars: data.costDollars };
  };
  return tool({
    description: lean ? `${description} Results show highlights only; the full page text is kept for the final answer.` : description,
    inputSchema: filters ? filteredInput : queryInput,
    execute: (input: FilteredInput, { abortSignal }) => run(input, abortSignal),
    toModelOutput: ({ output }) => ({
      type: "json",
      value: JSON.parse(JSON.stringify(lean ? { results: output.results.map(leanRow) } : output)) as JSONValue,
    }),
  }) as Tool<FilteredInput, SearchOutput>;
}

/** General web search, for routes that need a single search tool. */
export function createWebSearchTool(options: SearchOptions = {}) {
  return exaTool(
    "Search the web with Exa for current information, companies, people and source evidence. Returns URLs with text and highlights. Cite returned URLs. This does not reveal or verify emails.",
    {},
    options,
    true,
  );
}

const PAGE_TARGETS = ["about", "team", "careers", "pricing", "customers"];

/** The company's homepage and a few likely subpages, fetched directly without a search. */
export async function fetchCompanyPages(website: string, { textCharacters = 3_000, timeoutMs = 30_000, signal }: { textCharacters?: number; timeoutMs?: number; signal?: AbortSignal } = {}) {
  const data = await exaRequest<SearchOutput>("/contents", {
    urls: [website],
    text: { maxCharacters: textCharacters },
    subpages: 4,
    subpageTarget: PAGE_TARGETS,
  }, timeoutMs, signal);
  const pages: SearchRow[] = [];
  for (const row of (data.results ?? []).map(trim)) {
    pages.push({ ...row, subpages: undefined });
    pages.push(...(row.subpages ?? []).filter((page) => (page.text?.trim().length ?? 0) > 200));
  }
  return { pages, dollars: data.costDollars?.total ?? 0 };
}
