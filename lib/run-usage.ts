import type { DraftState, RunUsage, TokenUsage } from "./onboarding";

function price(name: string) {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Prices aren't reported by Bedrock or Fiber, so a total needs them configured. */
function prices() {
  return {
    inputPerMillion: price("OUTMAX_PRICE_INPUT_PER_M"),
    cachedInputPerMillion: price("OUTMAX_PRICE_CACHED_INPUT_PER_M"),
    outputPerMillion: price("OUTMAX_PRICE_OUTPUT_PER_M"),
    fiberCredit: price("OUTMAX_PRICE_FIBER_CREDIT"),
  };
}

function tokenDollars(tokens: TokenUsage | null, rates: ReturnType<typeof prices>) {
  if (!tokens || !tokens.modelCalls) return 0;
  if (rates.inputPerMillion === null || rates.outputPerMillion === null) return null;
  const cached = Math.min(tokens.cachedInputTokens, tokens.inputTokens);
  const cachedRate = rates.cachedInputPerMillion ?? rates.inputPerMillion;
  return ((tokens.inputTokens - cached) * rates.inputPerMillion + cached * cachedRate + tokens.outputTokens * rates.outputPerMillion) / 1_000_000;
}

/**
 * Usage for the run view, with draft tokens and an estimated total when prices allow.
 * `tracked` is false for older runs that didn't record every count, so they never get a partial total.
 */
export function runUsage(usage: Omit<RunUsage, "draftTokens" | "totalDollars">, drafts: DraftState | null, tracked: boolean): RunUsage {
  const draftTokens = drafts?.status === "ready" ? drafts.usage ?? null : null;
  const rates = prices();
  const parts = [
    usage.exaSearchDollars + usage.exaAgentDollars,
    tokenDollars(usage.leadTokens, rates),
    tokenDollars(draftTokens, rates),
    usage.fiberCredits ? (rates.fiberCredit === null ? null : usage.fiberCredits * rates.fiberCredit) : 0,
  ];
  const known = tracked && parts.every((part) => part !== null);
  return {
    ...usage,
    draftTokens,
    totalDollars: known ? parts.reduce<number>((sum, part) => sum + (part ?? 0), 0) : null,
  };
}
