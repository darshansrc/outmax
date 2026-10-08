"use client";

import { useEffect, useState } from "react";

type Pollable = { status?: string };

// Poll the existing GET only. Stop on terminal status or errors; a retry is always explicit.
export function useLeadData<T>(path: string, poll = false) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const response = await fetch(path, { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) {
          if (body.status && Array.isArray(body.leads)) setData(body);
          throw new Error(body.error ?? "Could not load this research. Please try again.");
        }
        setData(body);
        setError(null);
        setLoading(false);
        const status = (body as Pollable).status;
        if (poll && (status === "running" || status === "queued")) {
          timer = setTimeout(load, 5_000);
        }
      } catch (failure) {
        if (!controller.signal.aborted) {
          setError(failure instanceof Error ? failure.message : "Could not load research.");
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [path, poll, attempt]);

  function refresh() {
    setLoading(true);
    setAttempt((value) => value + 1);
  }
  return { data, error, loading, refresh };
}
