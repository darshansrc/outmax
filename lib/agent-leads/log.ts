import { AsyncLocalStorage } from "node:async_hooks";

const current = new AsyncLocalStorage<{ runId: string; startedAt: number }>();

/** Tags every agentLog inside `work` with the run and the time since the round started. */
export function withRunLog<T>(runId: string, work: () => Promise<T>) {
  return current.run({ runId, startedAt: Date.now() }, work);
}

/** One readable line per agent step. Set OUTMAX_AGENT_LOGS=0 to turn it off. */
export function agentLog(event: string, details?: Record<string, unknown>) {
  if (process.env.OUTMAX_AGENT_LOGS === "0") return;
  const run = current.getStore();
  const prefix = run ? `[outmax ${run.runId.slice(-8)} +${((Date.now() - run.startedAt) / 1000).toFixed(1)}s]` : "[outmax]";
  console.log(details ? `${prefix} ${event} ${JSON.stringify(details)}` : `${prefix} ${event}`);
}

export const short = (value: string | null | undefined, length = 140) =>
  !value ? value : value.length > length ? `${value.slice(0, length - 1)}…` : value;
