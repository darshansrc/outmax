import { after } from "next/server";
import Exa from "exa-js";
import { isActive, leadResult, RouteError } from "./lead-runs";
import type { OnboardingRun } from "./onboarding";
import { writeDrafts } from "./onboarding-drafts";
import { OnboardingStore } from "./onboarding-store";

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

/** Reads a run, refreshing it from Exa while active, and starts drafts once when it completes. */
export async function readOnboardingRun(runId: string, { retryDrafts = false } = {}) {
  try {
    if (!/^[\w-]{1,200}$/.test(runId)) throw new RouteError("Search not found.", 404);
    const store = new OnboardingStore();
    const context = await store.getContext(runId);
    if (!context) throw new RouteError("This search has expired or doesn’t exist.", 404);

    let run = await store.getRun(runId);
    if (!run || isActive(run)) {
      run = await new Exa(process.env.EXA_API_KEY).agent.runs.get(runId);
      await store.saveRun(run);
    }

    const body: OnboardingRun = {
      runId,
      status: run.status,
      createdAt: run.createdAt ?? context.createdAt,
      completedAt: run.completedAt ?? null,
      website: context.website,
      business: context.business,
      profile: context.profile,
      senderName: context.senderName,
      leads: [],
      shortfallReason: null,
      drafts: null,
    };

    if (run.status !== "completed") {
      if (!isActive(run)) body.error = `The search stopped before finishing (${run.stopReason ?? run.status}).`;
      return json(body);
    }

    const result = leadResult(run);
    body.leads = result.leads;
    body.shortfallReason = result.shortfallReason;
    if (!result.leads.length) return json(body);

    let drafts = await store.getDrafts(runId);
    const stale = drafts?.status === "pending" && Date.now() - drafts.startedAt > DRAFT_TIMEOUT_MS;
    const needsDrafts = !drafts || stale || (retryDrafts && drafts.status === "failed");
    if (needsDrafts && await store.claimDrafts(runId)) {
      drafts = { status: "pending", startedAt: Date.now() };
      await store.saveDrafts(runId, drafts);
      scheduleDrafts(store, runId, () => writeDrafts(context, result.leads));
    }
    body.drafts = drafts ?? { status: "pending", startedAt: Date.now() };
    return json(body);
  } catch (error) {
    const httpStatus = error instanceof RouteError ? error.httpStatus : 502;
    const message = error instanceof RouteError ? error.message : "We couldn’t load this search. Please try again.";
    if (httpStatus >= 500) console.error(JSON.stringify({ route: "onboarding/run", runId, httpStatus, errorType: error instanceof Error ? error.name : "UnknownError" }));
    return json({ error: message }, httpStatus);
  }
}
