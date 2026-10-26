import { readOnboardingRun } from "@/lib/onboarding-run";

export const maxDuration = 300;

export async function GET(_request: Request, { params }: RouteContext<"/api/onboarding/runs/[runId]">) {
  const { runId } = await params;
  return readOnboardingRun(runId);
}
