"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronRight, Clock3, Globe2, LoaderCircle, Plus, RefreshCw, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLeadData } from "@/hooks/use-lead-data";
import type { RunSummary } from "@/lib/lead-types";
import { domain, formatCost, formatDate, RunLoading, StatusBadge } from "./shared";

const EXAMPLE = "Find customers for https://elkagent.com. Focus on US Shopify stores.";

export function Home() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdRunId, setCreatedRunId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(10);
  const { data, error, loading, refresh } = useLeadData<{ runs: RunSummary[]; runCount: number }>("/api/leads");
  const runs = [...(data?.runs ?? [])]
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .filter((run) => `${run.prompt ?? ""} ${run.website ?? ""} ${run.runId} ${run.status}`.toLowerCase().includes(search.toLowerCase()));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || !prompt.trim()) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setCreatedRunId(null);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), waitForResults: false }),
      });
      const body = await response.json();
      if (body.runId) setCreatedRunId(body.runId);
      if (!response.ok) throw new Error(body.error ?? "Could not start research.");
      if (!body.runId) throw new Error("Research did not return a run ID.");
      router.push(`/leads/${encodeURIComponent(body.runId)}`);
    } catch (failure) {
      setSubmitError(failure instanceof Error ? failure.message : "Could not start research.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-5 pb-16 sm:px-8">
      <section className="pt-16 sm:pt-24">
        <div className="mb-5 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.15em] text-primary">
          <Sparkles className="size-3.5" /> A little research. A lot of possibility.
        </div>
        <h1 className="text-4xl font-medium tracking-[-0.055em] sm:text-5xl">Find your next customer.</h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
          Tell us what you sell and who you want to reach.<br className="hidden sm:block" /> Get companies that fit, with the people behind them.
        </p>
        <form onSubmit={submit} className="mt-8">
          <Card className="gap-0 rounded-2xl py-0 shadow-[0_4px_24px_-12px_rgba(0,0,0,0.12)] focus-within:ring-primary/30">
            <label htmlFor="prompt" className="px-5 pt-5 text-sm font-medium">Who are you looking for?</label>
            <Textarea
              id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)}
              placeholder={EXAMPLE} maxLength={8_000} required disabled={submitting}
              aria-describedby="prompt-help" aria-invalid={!!submitError}
              className="min-h-32 resize-none rounded-none border-0 px-5 pt-3 text-base! leading-7 shadow-none focus-visible:ring-0"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-5 py-4">
              <p id="prompt-help" className="flex items-center gap-2 text-xs text-muted-foreground">
                <Globe2 className="size-3.5" /> Include your product’s website URL
              </p>
              <Button type="submit" disabled={!prompt.trim() || submitting} className="h-10 gap-2 px-4">
                {submitting ? <><LoaderCircle className="animate-spin" /> Starting research…</>
                  : <>Find leads <ArrowRight /></>}
              </Button>
            </div>
          </Card>
          {submitError && (
            <div role="alert" className="mt-3 text-sm text-destructive">
              {submitError}
              {createdRunId && <Link href={`/leads/${encodeURIComponent(createdRunId)}`} className="ml-2 underline">Open the existing run</Link>}
              {!createdRunId && <p className="mt-1 text-muted-foreground">Check previous runs before submitting again if the connection was interrupted.</p>}
            </div>
          )}
        </form>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <Button variant="ghost" size="sm" className="-ml-2 text-xs font-normal text-muted-foreground" disabled={submitting} onClick={() => setPrompt(EXAMPLE)}>
            <Plus className="size-3!" /> Try an example
          </Button>
          <span>Up to 20 companies · Contacts &amp; sources included</span>
        </div>
      </section>

      <section className="mt-16" aria-labelledby="previous-runs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2 id="previous-runs" className="text-lg font-medium tracking-tight">Previous runs</h2>
            {data && <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{data.runCount}</span>}
          </div>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading} className="gap-2 text-muted-foreground">
            <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
        <div className="relative mt-5">
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input aria-label="Search previous runs" placeholder="Search your research…" value={search}
            onChange={(event) => { setSearch(event.target.value); setLimit(10); }}
            className="h-10 bg-card pl-9" />
        </div>
        {error && <div role="alert" className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
        {loading && !data ? <RunLoading /> : (
          <div className="mt-4 overflow-hidden rounded-xl border bg-card">
            {runs.slice(0, limit).map((run) => (
              <Link key={run.runId} href={`/leads/${encodeURIComponent(run.runId)}`} prefetch={false}
                className="group flex items-center gap-4 border-b px-4 py-5 transition-colors last:border-b-0 hover:bg-muted/50 sm:px-5">
                <span className="hidden size-10 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground sm:flex"><Globe2 className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{run.prompt ?? (domain(run.website) ? `Customers for ${domain(run.website)}` : `Research ${run.runId.replace("agent_run_", "").slice(0, 8)}`)}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Clock3 className="size-3" /> {formatDate(run.createdAt)}</span>
                    <span className="font-mono">{run.runId.replace("agent_run_", "").slice(0, 8)}</span>
                    {run.resultsAvailable ? <span>{run.returnedCount} companies</span>
                      : run.status === "completed" ? <span>Results unavailable</span> : null}
                    <span>Exa research: {formatCost(run.costDollars.exaAgentReported?.total)}</span>
                  </div>
                </div>
                <StatusBadge status={run.status} />
                <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
              </Link>
            ))}
            {!runs.length && <div className="px-6 py-12 text-center">
              <Search className="mx-auto mb-3 size-5 text-muted-foreground" />
              <p className="text-sm font-medium">{search ? "No matching runs" : "Your research starts here"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{search ? "Try another search." : "Enter a prompt above to find your first customers."}</p>
            </div>}
          </div>
        )}
        {runs.length > limit && <div className="mt-5 text-center">
          <Button variant="outline" onClick={() => setLimit((value) => value + 10)}>Show more runs</Button>
        </div>}
      </section>
      <footer className="mt-12 border-t pt-6 text-xs text-muted-foreground">Made for finding the right fit.</footer>
    </main>
  );
}
