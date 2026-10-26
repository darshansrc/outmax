import { randomUUID } from "node:crypto";
import Exa, { ExaError } from "exa-js";
import { z } from "zod";
import { MODEL } from "@/lib/provider";
import { isActive, RouteError, WaitTimeout, within } from "@/lib/lead-runs";
import { prototypeLogger, prototypeResult, prototypeSelection } from "@/lib/orchestrated-leads";

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const requestId = randomUUID();
  const log = prototypeLogger(requestId);
  const { runId } = await params;
  log("contact_run_retrieval", "started", { runId });
  try {
    if (!z.string().regex(/^agent_run_[A-Za-z0-9]+$/).safeParse(runId).success) throw new RouteError("Invalid run ID.", 400);
    if (!process.env.EXA_API_KEY?.trim()) throw new RouteError("EXA_API_KEY is not configured.", 500);
    const run = await within(new Exa(process.env.EXA_API_KEY).agent.runs.get(runId), 30_000);
    const selection = prototypeSelection(run);
    const { cleanup, ...result } = prototypeResult(selection, run);
    const status = isActive(run) ? 202 : run.status === "completed" ? 200 : 502;
    log("contact_run_retrieval", "completed", {
      runId, runStatus: run.status, returnedCount: result.returnedCount, cleanup,
      usage: run.usage ?? null, costDollarsReported: run.costDollars ?? null,
    });
    return Response.json({
      requestId, ...result, statusUrl: `/api/leads/orchestrated/${runId}`,
      ...(status === 502 ? { error: `Contact lookup ${run.status}.` } : {}),
      usage: { ai: { model: MODEL, tokens: null }, exaContacts: run.usage ?? null },
      costDollars: { exaSearchReported: null, exaContactsReported: run.costDollars ?? null },
    }, { status, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
  } catch (error) {
    const status = error instanceof RouteError ? error.httpStatus
      : error instanceof ExaError && error.statusCode === 404 ? 404
      : error instanceof WaitTimeout ? 504 : 502;
    log("contact_run_retrieval", status === 504 ? "timeout" : "error", { runId, httpStatus: status, errorType: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({
      requestId, runId,
      error: error instanceof RouteError ? error.message : status === 404 ? "Run not found." : "Could not retrieve this contact run.",
    }, { status, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
  }
}
