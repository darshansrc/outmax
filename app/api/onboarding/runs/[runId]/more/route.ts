import { findMoreLeads } from "@/lib/onboarding-run";

export const maxDuration = 300;

export async function POST(request: Request, { params }: RouteContext<"/api/onboarding/runs/[runId]/more">) {
  const { runId } = await params;
  const body: unknown = await request.json().catch(() => null);
  const count = body && typeof body === "object" && "count" in body ? body.count : undefined;
  return findMoreLeads(runId, count);
}
