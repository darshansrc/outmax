import { randomUUID } from "node:crypto";
import Exa from "exa-js";
import { agentOutputSchema, TARGET_COUNT } from "@/lib/leads";
import { RouteError, setting } from "@/lib/lead-runs";
import { normalizeWebsite, searchQuery, startRunSchema } from "@/lib/onboarding";
import { OnboardingStore } from "@/lib/onboarding-store";

export async function POST(request: Request) {
  const requestId = randomUUID();
  try {
    const parsed = startRunSchema.safeParse(await request.json().catch(() => null));
    const website = parsed.success ? normalizeWebsite(parsed.data.website) : null;
    if (!parsed.success || !website) throw new RouteError("Your profile is incomplete. Go back and check each field.", 400);
    const input = { ...parsed.data, website, senderName: parsed.data.senderName || null };

    for (const name of ["EXA_API_KEY", "AI_GATEWAY_API_KEY"]) {
      if (!process.env[name]?.trim()) throw new RouteError(`${name} is not configured.`, 500);
    }
    const store = new OnboardingStore();
    const exa = new Exa(process.env.EXA_API_KEY);
    const run = await exa.agent.runs.create({
      effort: "auto",
      budget: { maxCostDollars: setting("EXA_RUN_BUDGET_DOLLARS", 5) },
      dataSources: [{ provider: "fiber" }],
      metadata: { requestId, app: "outmax", flow: "onboarding" },
      outputSchema: agentOutputSchema,
      query: searchQuery(input),
    });
    await store.saveContext(run.id, { ...input, requestId, createdAt: run.createdAt ?? new Date().toISOString() });
    await store.saveRun(run);
    console.log(JSON.stringify({ route: "onboarding/runs", requestId, runId: run.id, status: run.status, targetCount: TARGET_COUNT }));
    return Response.json({ runId: run.id, status: run.status }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const httpStatus = error instanceof RouteError ? error.httpStatus : 502;
    const message = error instanceof RouteError ? error.message : "We couldn’t start the search. Please try again.";
    console.error(JSON.stringify({ route: "onboarding/runs", requestId, httpStatus, errorType: error instanceof Error ? error.name : "UnknownError" }));
    return Response.json({ error: message }, { status: httpStatus, headers: { "Cache-Control": "no-store" } });
  }
}
