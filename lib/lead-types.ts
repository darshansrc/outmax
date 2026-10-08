import type { ICP, Lead } from "./leads";
import type { runSummary } from "./lead-runs";

export type RunSummary = ReturnType<typeof runSummary>;

export type RunDetail = Omit<RunSummary, "resultsAvailable" | "validationError"> & {
  icp: ICP | null;
  leads: Lead[];
  shortfallReason: string | null;
  error?: string;
};
