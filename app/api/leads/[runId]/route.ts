import { readLeadRuns } from "@/lib/lead-run-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  return readLeadRuns(runId);
}
