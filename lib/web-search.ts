import { gateway, tool } from "ai";

function camelCaseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelCaseKeys);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase()),
    camelCaseKeys(item),
  ]));
}

export function createWebSearchTool() {
  // Retain the input schema so existing saved search calls remain compatible.
  const search = gateway.tools.exaSearch();
  return tool({
    description: "Search the web with Exa for current information, companies, and source evidence. Returns URLs, content highlights, and reported search cost. Cite returned URLs. This does not reveal or verify emails; use the Fiber tools for contact lookups.",
    inputSchema: search.inputSchema,
    execute: async (input, { abortSignal }) => {
      const apiKey = process.env.EXA_API_KEY?.trim();
      if (!apiKey) throw new Error("EXA_API_KEY is not configured.");
      if (!input.query.trim()) throw new Error("Provide a non-empty search query.");
      const signal = AbortSignal.any([
        AbortSignal.timeout(60_000),
        ...(abortSignal ? [abortSignal] : []),
      ]);

      let response: Response;
      try {
        response = await fetch("https://api.exa.ai/search", {
          method: "POST",
          headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify(camelCaseKeys({
            ...input,
            num_results: Math.max(1, Math.min(20, Math.floor(input.num_results ?? 10))),
            contents: input.contents ?? { highlights: true },
          })),
          cache: "no-store",
          signal,
        });
      } catch {
        throw new Error(signal.aborted
          ? "The web search was stopped or timed out."
          : "Unable to connect to Exa. Please try again.");
      }

      if (!response.ok) {
        throw new Error(`Exa search returned HTTP ${response.status}. Check search parameters, API access, and account limits.`);
      }
      const data: unknown = await response.json().catch(() => null);
      if (data === null || typeof data !== "object" || !("results" in data) || !Array.isArray(data.results)) {
        throw new Error("Exa returned an invalid search response.");
      }
      return data;
    },
  });
}
