import { Redis } from "@upstash/redis";
import type { AgentRun } from "exa-js";
import type { AgentState } from "./agent-leads/engine";
import { RouteError, setting } from "./lead-runs";
import type { DraftState, StartRun } from "./onboarding";

export type OnboardingContext = StartRun & { requestId: string; createdAt: string };

const key = (kind: string, runId: string) => `outmax:onboarding:${kind}:${runId}`;

export class OnboardingStore {
  private readonly redis: Redis;
  readonly ttlSeconds = setting("ONBOARDING_REDIS_TTL_SECONDS", 30 * 86_400, true);

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
      throw new RouteError("Run storage is temporarily unavailable.", 503);
    }
  }

  getContext(runId: string) {
    return this.execute(this.redis.get<OnboardingContext>(key("context", runId)));
  }

  async saveContext(runId: string, context: OnboardingContext) {
    await this.execute(this.redis.set(key("context", runId), context, { ex: this.ttlSeconds }));
  }

  getRun(runId: string) {
    return this.execute(this.redis.get<AgentRun>(key("run", runId)));
  }

  async saveRun(run: AgentRun) {
    await this.execute(this.redis.set(key("run", run.id), run, { ex: this.ttlSeconds }));
  }

  getDrafts(runId: string) {
    return this.execute(this.redis.get<DraftState>(key("drafts", runId)));
  }

  async saveDrafts(runId: string, drafts: DraftState) {
    await this.execute(this.redis.set(key("drafts", runId), drafts, { ex: this.ttlSeconds }));
  }

  /** Returns true for exactly one caller until the lock expires or is released. */
  async claimDrafts(runId: string) {
    const claimed = await this.execute(this.redis.set(key("drafts-lock", runId), 1, { nx: true, ex: 290 }));
    return claimed === "OK";
  }

  async releaseDrafts(runId: string) {
    await this.execute(this.redis.del(key("drafts-lock", runId)));
  }

  getAgent(runId: string) {
    return this.execute(this.redis.get<AgentState>(key("agent", runId)));
  }

  async saveAgent(runId: string, state: AgentState) {
    await this.execute(this.redis.set(key("agent", runId), state, { ex: this.ttlSeconds }));
  }

  /** One search round at a time. Must outlive the route's maxDuration so rounds never overlap. */
  async claimAgent(runId: string) {
    const claimed = await this.execute(this.redis.set(key("agent-lock", runId), 1, { nx: true, ex: 310 }));
    return claimed === "OK";
  }

  async releaseAgent(runId: string) {
    await this.execute(this.redis.del(key("agent-lock", runId)));
  }
}
