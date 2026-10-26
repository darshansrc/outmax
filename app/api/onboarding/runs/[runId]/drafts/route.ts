import { readOnboardingRun } from "@/lib/onboarding-run";

export const maxDuration = 300;

export async function POST(_request: Request, { params }: RouteContext<"/api/onboarding/runs/[runId]/drafts">) {
  const { runId } = await params;
  return readOnboardingRun(runId, { retryDrafts: true });
}
