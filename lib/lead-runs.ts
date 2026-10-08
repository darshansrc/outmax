import { Redis } from "@upstash/redis";
import type { LanguageModelUsage } from "ai";
import type { AgentRun, CostDollars } from "exa-js";
import { cleanLeads, MODEL, resultSchema, TARGET_COUNT, type ICP } from "./leads";

export class RouteError extends Error {
  constructor(message: string, readonly httpStatus: number) {
    super(message);
  }
}

export class WaitTimeout extends Error {}

export async function within<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new WaitTimeout()), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function setting(name: string, fallback: number, integer = false): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0 || (integer && !Number.isSafeInteger(value))) {
    throw new RouteError(`${name} must be a positive ${integer ? "integer" : "number"}.`, 500);
  }
  return value;
}

export interface RunContext {
  requestId: string;
  prompt: string;
  website: string;
  icp: ICP;
  aiUsage: LanguageModelUsage;
  websiteCost: CostDollars | null;
  budgetDollars: number;
}

export function isActive(run: AgentRun) {
  return run.status === "queued" || run.status === "running";
}

// Separate keys prevent a concurrent status refresh from overwriting the original accounting.
export class RunStore {
  private readonly redis: Redis;
  readonly ttlSeconds = setting("LEADS_REDIS_TTL_SECONDS", 86_400, true);

  constructor() {
    for (const name of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) {
      if (!process.env[name]?.trim()) throw new RouteError(`${name} is not configured.`, 500);
    }
    this.redis = Redis.fromEnv({
      signal: () => AbortSignal.timeout(10_000),
      retry: false,
      enableTelemetry: false,
    });
  }

  private async execute<T>(command: Promise<T>): Promise<T> {
    try {
      return await command;
    } catch {
      throw new RouteError("Temporary Redis run storage is unavailable.", 503);
    }
  }

  async check() {
    await this.execute(this.redis.ping());
  }

  async getContext(runId: string) {
    return this.execute(this.redis.get<RunContext>(`outmax:leads:context:${runId}`));
  }

  async getRun(runId: string) {
    return this.execute(this.redis.get<AgentRun>(`outmax:leads:run:${runId}`));
  }

  async saveContext(runId: string, context: RunContext) {
    await this.execute(this.redis.set(`outmax:leads:context:${runId}`, context, {
      ex: this.ttlSeconds,
    }));
  }

  async saveRun(run: AgentRun) {
    await this.execute(this.redis.set(`outmax:leads:run:${run.id}`, run, {
      ex: this.ttlSeconds,
    }));
  }

  async getContexts(runIds: string[]) {
    if (!runIds.length) return [];
    return this.execute(this.redis.mget<(RunContext | null)[]>(
      ...runIds.map((id) => `outmax:leads:context:${id}`),
    ));
  }
}

export function leadResult(run: AgentRun) {
  const result = resultSchema.safeParse(run.output?.structured);
  if (!result.success) throw new RouteError("Exa Agent returned an invalid lead structure.", 502);
  const { leads, ...cleanup } = cleanLeads(result.data.leads);
  const shortfallReason = leads.length === TARGET_COUNT ? null : [
    result.data.shortfallReason ??
      `Exa returned ${result.data.leads.length} companies; stop reason: ${run.stopReason ?? "unreported"}.`,
    cleanup.duplicatesRemoved ? `${cleanup.duplicatesRemoved} duplicate companies removed.` : null,
    cleanup.unsupportedRemoved ? `${cleanup.unsupportedRemoved} companies without qualification evidence removed.` : null,
  ].filter(Boolean).join(" ");
  return { leads, returnedCount: leads.length, shortfallReason, cleanup };
}

export function runAccounting(run: AgentRun, context: RunContext | null) {
  return {
    usage: {
      ai: { model: MODEL, tokens: context?.aiUsage ?? null },
      exaAgent: run.usage ?? null,
    },
    costDollars: {
      exaWebsiteReported: context?.websiteCost ?? null,
      exaAgentReported: run.costDollars ?? null,
    },
  };
}

export function runSummary(run: AgentRun, context: RunContext | null) {
  const parsed = run.status === "completed"
    ? resultSchema.safeParse(run.output?.structured) : null;
  const cleaned = parsed?.success ? cleanLeads(parsed.data.leads) : null;
  return {
    runId: run.id,
    status: run.status,
    stopReason: run.stopReason ?? null,
    createdAt: run.createdAt ?? null,
    completedAt: run.completedAt ?? null,
    prompt: context?.prompt ?? null,
    website: context?.website ?? null,
    returnedCount: cleaned?.leads.length ?? (isActive(run) ? 0 : null),
    resultsAvailable: parsed?.success ?? false,
    validationError: parsed && !parsed.success ? "Run output does not match the Outmax lead schema." : null,
    ...runAccounting(run, context),
  };
}
