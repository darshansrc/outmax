import { useMemo, useSyncExternalStore } from "react";

export type RecentRun = { runId: string; website: string; createdAt: string };

const KEY = "outmax:recent-runs";

function parse(raw: string | null): RecentRun[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((run) => typeof run?.runId === "string") : [];
  } catch {
    return [];
  }
}

function readRecentRuns(): RecentRun[] {
  try {
    return parse(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function useRecentRuns() {
  const raw = useSyncExternalStore(subscribe, () => {
    try { return localStorage.getItem(KEY); } catch { return null; }
  }, () => null);
  return useMemo(() => parse(raw), [raw]);
}

export function rememberRun(run: RecentRun) {
  try {
    const runs = [run, ...readRecentRuns().filter((item) => item.runId !== run.runId)].slice(0, 20);
    localStorage.setItem(KEY, JSON.stringify(runs));
  } catch {}
}
