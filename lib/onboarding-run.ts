import { after } from "next/server";
import Exa from "exa-js";
import { advanceAgentRun, toLead } from "./agent-leads/engine";
import { costOf } from "./agent-leads/fiber";
import { isActive, leadResult, RouteError } from "./lead-runs";
import type { Lead } from "./leads";
import type { OnboardingRun } from "./onboarding";
import { writeDrafts } from "./onboarding-drafts";
import { OnboardingStore, type OnboardingContext } from "./onboarding-store";

const DRAFT_TIMEOUT_MS = 300_000;

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function scheduleDrafts(store: OnboardingStore, runId: string, work: () => ReturnType<typeof writeDrafts>) {
  after(async () => {
    try {
      const sequences = await work();
      await store.saveDrafts(runId, { status: "ready", sequences });
    } catch (error) {
      console.error(JSON.stringify({ route: "onboarding/drafts", runId, errorType: error instanceof Error ? error.name : "UnknownError" }));
      await store.saveDrafts(runId, { status: "failed", error: "We couldn’t write the drafts. Try again." }).catch(() => {});
    } finally {
      await store.releaseDrafts(runId).catch(() => {});
    }
  });
}

async function withDrafts(store: OnboardingStore, context: OnboardingContext, body: OnboardingRun, leads: Lead[], retryDrafts: boolean) {
  let drafts = await store.getDrafts(body.runId);
  const stale = drafts?.status === "pending" && Date.now() - drafts.startedAt > DRAFT_TIMEOUT_MS;
  const needsDrafts = !drafts || stale || (retryDrafts && drafts.status === "failed");
  if (needsDrafts && await store.claimDrafts(body.runId)) {
    drafts = { status: "pending", startedAt: Date.now() };
    await store.saveDrafts(body.runId, drafts);
    scheduleDrafts(store, body.runId, () => writeDrafts(context, leads));
  }
  body.drafts = drafts ?? { status: "pending", startedAt: Date.now() };
}

function baseRun(runId: string, context: OnboardingContext): OnboardingRun {
  return {
    runId,
    status: "running",
    createdAt: context.createdAt,
    completedAt: null,
    website: context.website,
    business: context.business,
    profile: context.profile,
    senderName: context.senderName,
    leads: [],
    shortfallReason: null,
    drafts: null,
    engine: context.engine === "outmax" ? "outmax" : "exa",
    // Searches started before the lead count option always asked for 20.
    leadCount: context.leadCount ?? 20,
    costs: null,
    progress: null,
  };
}

async function readAgentRun(store: OnboardingStore, runId: string, context: OnboardingContext, retryDrafts: boolean) {
  const state = await store.getAgent(runId);
  if (!state) throw new RouteError("This search has expired or doesn’t exist.", 404);
  if (state.status === "running") after(() => advanceAgentRun(runId, context));

  const body = baseRun(runId, context);
  body.status = state.status;
  body.completedAt = state.completedAt;
  // Runs saved before the cost breakdown kept Exa totals under `exa`.
  const legacy = (state as { exa?: { searchDollars: number; fiberDollars: number } }).exa;
  body.costs = state.costs
    ? { exaSearchDollars: state.costs.searchDollars, exaAgentDollars: state.costs.agentDollars, fiberCredits: state.costs.fiberCredits }
    : { exaSearchDollars: legacy?.searchDollars ?? 0, exaAgentDollars: legacy?.fiberDollars ?? 0, fiberCredits: 0 };
  body.progress = { stage: state.stage, checked: state.checked, accepted: state.accepted.length, rejected: state.rejected };
  body.leads = state.accepted.map(toLead);
  body.shortfallReason = state.shortfallReason;
  if (state.status === "failed") body.error = state.error ?? "The search stopped before finishing.";
  if (state.status === "completed" && body.leads.length) await withDrafts(store, context, body, body.leads, retryDrafts);
  return json(body);
}

/** Reads a run, moving it forward while active, and starts drafts once when it completes. */
export async function readOnboardingRun(runId: string, { retryDrafts = false } = {}) {
  try {
    if (!/^[\w-]{1,200}$/.test(runId)) throw new RouteError("Search not found.", 404);
    const store = new OnboardingStore();
    const context = await store.getContext(runId);
    if (!context) throw new RouteError("This search has expired or doesn’t exist.", 404);
    if (context.engine === "outmax") return await readAgentRun(store, runId, context, retryDrafts);

    let run = await store.getRun(runId);
    if (!run || isActive(run)) {
      run = await new Exa(process.env.EXA_API_KEY).agent.runs.get(runId);
      await store.saveRun(run);
    }

    const body = baseRun(runId, context);
    body.status = run.status;
    body.createdAt = run.createdAt ?? context.createdAt;
    body.completedAt = run.completedAt ?? null;
    body.costs = run.costDollars?.total === undefined ? null : { exaSearchDollars: 0, exaAgentDollars: costOf(run), fiberCredits: 0 };

    if (run.status !== "completed") {
      if (!isActive(run)) body.error = `The search stopped before finishing (${run.stopReason ?? run.status}).`;
      return json(body);
    }

    const result = leadResult(run, body.leadCount);
    body.leads = result.leads;
    body.shortfallReason = result.shortfallReason;
    if (result.leads.length) await withDrafts(store, context, body, result.leads, retryDrafts);
    return json(body);
  } catch (error) {
    const httpStatus = error instanceof RouteError ? error.httpStatus : 502;
    const message = error instanceof RouteError ? error.message : "We couldn’t load this search. Please try again.";
    if (httpStatus >= 500) console.error(JSON.stringify({ route: "onboarding/run", runId, httpStatus, errorType: error instanceof Error ? error.name : "UnknownError" }));
    return json({ error: message }, httpStatus);
  }
}
