import { randomUUID } from "node:crypto";
import Exa, { ExaError } from "exa-js";
import { z } from "zod";
import {
  isActive, isOutmaxRun, leadResult, RouteError, runAccounting, RunStore,
  runSummary, WaitTimeout, within,
} from "./lead-runs";

const runIdSchema = z.string().min(1).max(200).regex(/^[A-Za-z0-9_.:-]+$/);

export async function readLeadRuns(runId?: string) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let step = "request_validation";

  function log(status: string, fields: Record<string, unknown> = {}) {
    const entry = JSON.stringify({
      ...fields, requestId, step, status, elapsedMs: Date.now() - startedAt,
      runId: runId ?? null,
    });
    if (status === "error" || status === "timeout") console.error(entry);
    else console.log(entry);
  }
  function respond(body: Record<string, unknown>, status = 200) {
    step = "response";
    log("completed", { httpStatus: status, returnedCount: body.returnedCount ?? body.runCount ?? 0 });
    return Response.json({ requestId, ...body }, {
      status,
      headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
    });
  }

  log("received");
  try {
    if (runId !== undefined && !runIdSchema.safeParse(runId).success) {
      throw new RouteError("Invalid run ID.", 400);
    }
    log("completed");
    step = "configuration";
    if (!process.env.EXA_API_KEY?.trim()) throw new RouteError("EXA_API_KEY is not configured.", 500);
    const store = new RunStore();
    const exa = new Exa(process.env.EXA_API_KEY);

    if (runId === undefined) {
      step = "exa_run_listing";
      log("started");
      // Fetch every page, then keep only research belonging to this app.
      const runs = await within(exa.agent.runs.getAll({ limit: 100 }), 30_000);
      log("completed", { runCount: runs.length });
      step = "redis_read";
      const contexts = await store.getContexts(runs.map((run) => run.id));
      log("completed", { runCount: runs.length });
      const summaries = runs.flatMap((run, index) => {
        const context = contexts[index] ?? null;
        return isOutmaxRun(run, context) ? [runSummary(run, context)] : [];
      });
      return respond({ runs: summaries, runCount: summaries.length });
    }

    step = "redis_read";
    const [context, cached] = await Promise.all([store.getContext(runId), store.getRun(runId)]);
    log("completed", { cacheHit: !!cached });
    const source = cached && !isActive(cached) ? "redis" : "exa";
    let run = cached;
    if (source === "exa") {
      step = "exa_run_retrieval";
      log("started");
      run = await within(exa.agent.runs.get(runId), 30_000);
      log("completed", {
        runStatus: run.status, stopReason: run.stopReason ?? null,
        usage: run.usage ?? null, costDollarsReported: run.costDollars ?? null,
      });
      step = "redis_write";
      await store.saveRun(run);
      log("completed", { ttlSeconds: store.ttlSeconds });
    }
    if (!run) throw new RouteError("Run not found.", 404);
    const base = {
      runId: run.id, status: run.status, stopReason: run.stopReason ?? null,
      createdAt: run.createdAt ?? null, completedAt: run.completedAt ?? null,
      prompt: context?.prompt ?? null, website: context?.website ?? null,
      icp: context?.icp ?? null, source, ...runAccounting(run, context),
    };
    if (isActive(run)) {
      return respond({
        ...base, leads: [], returnedCount: 0,
        shortfallReason: `Run is ${run.status}. Repeat this GET request to retrieve results when ready.`,
      }, 202);
    }
    if (run.status !== "completed") {
      return respond({
        ...base, leads: [], returnedCount: 0,
        shortfallReason: `Exa Agent run ${run.status}.`,
        error: `Exa Agent run ${run.status} (stop reason: ${run.stopReason ?? "unreported"}).`,
      }, 502);
    }
    step = "output_validation";
    const { cleanup, ...result } = leadResult(run);
    log("completed", { ...cleanup, returnedCount: result.returnedCount });
    return respond({ ...base, ...result });
  } catch (error) {
    const status = error instanceof RouteError ? error.httpStatus
      : error instanceof ExaError && error.statusCode === 404 ? 404
      : error instanceof WaitTimeout ? 504 : 502;
    const message = error instanceof RouteError ? error.message
      : status === 404 ? "Run not found."
      : status === 504 ? `Timed out during ${step}.` : `Failed during ${step}.`;
    const failingStep = step;
    log(status === 504 ? "timeout" : "error", {
      failingStep, errorType: error instanceof Error ? error.name : "UnknownError",
      upstreamStatus: error instanceof ExaError ? error.statusCode : undefined,
      httpStatus: status,
    });
    return respond({ error: message, step: failingStep, runId: runId ?? null }, status);
  }
}
