"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, Copy, FileSearch, Globe2, LoaderCircle, MapPin, RefreshCw, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLeadData } from "@/hooks/use-lead-data";
import type { RunDetail as RunData } from "@/lib/lead-types";
import type { ICP, Lead } from "@/lib/leads";
import { domain, formatCost, formatDate, RunLoading, SourceLink, StatusBadge } from "./shared";

function Profile({ icp }: { icp: ICP }) {
  return (
    <details className="group rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <FileSearch className="size-4 text-primary" />
          <div>
            <span className="text-sm font-medium">Customer profile</span>
            <p className="mt-1 text-xs text-muted-foreground">
              {[icp.industries.join(", "), icp.geography.join(", ")].filter(Boolean).join(" · ") || "Your research criteria"}
            </p>
          </div>
        </div>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t px-5 py-5 text-sm">
        <p className="max-w-3xl leading-6 text-muted-foreground">{icp.productSummary}</p>
        <dl className="mt-5 grid gap-5 sm:grid-cols-3">
          {[
            ["Industries", icp.industries.join(", ")],
            ["Company size", icp.companySize],
            ["Geography", icp.geography.join(", ")],
            ["Buyer roles", icp.buyerRoles.join(", ")],
          ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 leading-6">{value || "Not specified"}</dd></div>)}
        </dl>
        <div className="mt-5">
          <p className="text-xs text-muted-foreground">Qualification criteria</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 leading-6">
            {icp.qualificationCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}
          </ul>
        </div>
        {!!icp.explicitUserInstructions.length && <div className="mt-5 rounded-lg bg-muted/50 p-4">
          <p className="text-xs font-medium">Your instructions</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {icp.explicitUserInstructions.map((instruction) => <li key={instruction}>{instruction}</li>)}
          </ul>
        </div>}
      </div>
    </details>
  );
}

function Evidence({ title, urls }: { title: string; urls: string[] | null }) {
  return <div>
    <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
    {urls?.length ? <ul className="mt-2 space-y-1.5">
      {urls.map((url, index) => <li key={`${url}-${index}`}><SourceLink href={url}>{domain(url)}{urls.length > 1 ? ` · Source ${index + 1}` : ""}</SourceLink></li>)}
    </ul> : <p className="mt-2 text-sm text-muted-foreground">Not available</p>}
  </div>;
}

function LeadRow({ lead, index }: { lead: Lead; index: number }) {
  const verification = lead.emailVerificationStatus;
  return (
    <details className="group border-b last:border-b-0">
      <summary className="grid cursor-pointer list-none items-start gap-4 p-5 hover:bg-muted/30 sm:grid-cols-[1.1fr_1fr_1fr_20px] sm:items-center">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-xs font-medium text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
          <div className="min-w-0">
            <h3 className="text-sm font-medium">{lead.companyName}</h3>
            <p className="mt-1 truncate text-xs text-muted-foreground">{domain(lead.website) ?? "Website unavailable"}</p>
            {lead.location && <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground"><MapPin className="mt-0.5 size-3 shrink-0" />{lead.location}</p>}
          </div>
        </div>
        <div className="min-w-0 pl-12 sm:pl-0">
          <p className="text-sm">{lead.contactName ?? "Contact not available"}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{lead.jobTitle ?? "Role unavailable"}</p>
        </div>
        <div className="min-w-0 pl-12 sm:pl-0">
          <p className="break-all text-sm">{lead.workEmail ?? "Email not available"}</p>
          {lead.workEmail && <Badge variant="secondary" className={`mt-1.5 h-5 text-[10px] font-normal ${
            verification === "verified" ? "bg-emerald-50 text-emerald-800" : "text-muted-foreground"
          }`}>
            {verification === "verified" ? "Verified" : verification === "catch_all" ? "Catch-all"
              : verification === "invalid" ? "Invalid" : "Not verified"}
          </Badge>}
        </div>
        <ChevronDown className="size-4 justify-self-end text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t bg-muted/20 px-5 py-5 sm:pl-[4.25rem]">
        <div className="flex flex-wrap gap-5">
          {lead.website && <SourceLink href={lead.website}><span className="inline-flex items-center gap-1.5"><Globe2 className="size-3.5" />Company website</span></SourceLink>}
          {lead.linkedInUrl && <SourceLink href={lead.linkedInUrl}>LinkedIn profile</SourceLink>}
        </div>
        <h4 className="mt-5 text-xs font-medium text-muted-foreground">Why this company fits</h4>
        <p className="mt-2 max-w-3xl text-sm leading-6">{lead.fitExplanation ?? "Not available"}</p>
        <div className="mt-5 grid gap-6 sm:grid-cols-3">
          <Evidence title="Company evidence" urls={lead.sourceUrls} />
          <Evidence title="Contact evidence" urls={lead.contactSourceUrls} />
          <div>
            <h4 className="text-xs font-medium text-muted-foreground">Contact data source</h4>
            <p className="mt-2 break-words text-sm leading-6">{lead.contactDataSource ?? "Not available"}</p>
            <p className="mt-3 text-xs text-muted-foreground">Email verification evidence</p>
            {lead.emailVerificationEvidence ? <div className="mt-2 text-sm">
              <SourceLink href={lead.emailVerificationEvidence.sourceUrl}>{lead.emailVerificationEvidence.source}</SourceLink>
              <p className="mt-1 break-all text-xs text-muted-foreground">{lead.emailVerificationEvidence.email} · {lead.emailVerificationEvidence.result}</p>
            </div> : <p className="mt-1 text-sm text-muted-foreground">Not available</p>}
          </div>
        </div>
      </div>
    </details>
  );
}

export function RunDetail({ runId }: { runId: string }) {
  const { data: run, error, loading, refresh } = useLeadData<RunData>(`/api/leads/${encodeURIComponent(runId)}`, true);
  const [search, setSearch] = useState("");
  const [emailsOnly, setEmailsOnly] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const active = run?.status === "running" || run?.status === "queued";
  const leads = run?.leads ?? [];
  const emailCount = leads.filter((lead) => lead.workEmail).length;
  const filtered = leads.filter((lead) => (!emailsOnly || lead.workEmail)
    && `${lead.companyName ?? ""} ${lead.contactName ?? ""} ${lead.jobTitle ?? ""} ${lead.location ?? ""} ${lead.workEmail ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  async function copyId() {
    try {
      await navigator.clipboard.writeText(runId);
      setCopied(true);
      setCopyError(false);
    } catch { setCopyError(true); }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pt-10">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />All research</Link>
      {loading && !run ? <RunLoading /> : (
        <>
          <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-medium tracking-[-0.04em] sm:text-4xl">{domain(run?.website ?? null) ? `Customers for ${domain(run?.website ?? null)}` : "Lead research"}</h1>
                {run && <StatusBadge status={run.status} />}
                {run && <span className="rounded-md border bg-card px-2.5 py-1 text-xs text-muted-foreground">
                  Exa research: <span className="font-medium text-foreground">{formatCost(run.costDollars.exaAgentReported?.total)}</span>{active ? " so far" : ""}
                </span>}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{run?.createdAt ? `Started ${formatDate(run.createdAt)}` : "Your research workspace"}</p>
            </div>
            <Button variant="outline" onClick={refresh} disabled={loading} className="gap-2 bg-card">
              <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
          {run?.prompt && <p className="mt-6 max-w-3xl text-sm leading-6 text-muted-foreground">{run.prompt}</p>}
          {error && <div role="alert" className="mt-6 rounded-xl border border-destructive/20 bg-destructive/5 p-5">
            <p className="text-sm font-medium text-destructive">Could not load results</p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={refresh} disabled={loading}>Try again</Button>
          </div>}
          {active && !error && <div role="status" aria-live="polite" className="mt-8 flex items-center gap-4 rounded-xl border bg-card p-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/5"><LoaderCircle className="size-5 animate-spin text-primary" /></span>
            <div><p className="text-sm font-medium">{run?.status === "queued" ? "Your research is queued" : "Finding matching companies"}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Results will appear here when ready. You can leave and come back to this run.</p></div>
          </div>}
          {run?.icp && <div className="mt-8"><Profile icp={run.icp} /></div>}
          {run?.status === "completed" && (
            <section className="mt-10" aria-labelledby="results-title">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div><h2 id="results-title" className="text-xl font-medium tracking-tight">Your leads <span className="ml-1 text-muted-foreground">{leads.length}</span></h2>
                  <p className="mt-2 text-sm text-muted-foreground">{emailCount} with work emails · Expand a company to see fit and sources</p></div>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="size-3.5" />One decision-maker per company</span>
              </div>
              {run.shortfallReason && <p className="mt-4 rounded-lg border bg-card p-4 text-sm leading-6 text-muted-foreground">{run.shortfallReason}</p>}
              {!!leads.length && <div className="mt-6 flex flex-wrap items-center gap-3">
                <div className="relative min-w-48 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search leads" placeholder="Search companies, people, or locations…" className="h-10 bg-card pl-9" />
                </div>
                <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground">
                  <input type="checkbox" checked={emailsOnly} onChange={(event) => setEmailsOnly(event.target.checked)} className="accent-primary" />With email
                </label>
              </div>}
              <div className="mt-4 overflow-hidden rounded-xl border bg-card">
                {!!filtered.length && <div className="hidden grid-cols-[1.1fr_1fr_1fr_20px] gap-4 border-b bg-muted/30 px-5 py-3 text-xs text-muted-foreground sm:grid">
                  <span>Company</span><span>Decision-maker</span><span>Work email</span><span />
                </div>}
                {filtered.map((lead) => <LeadRow key={lead.website ?? lead.companyName} lead={lead} index={leads.indexOf(lead)} />)}
                {!filtered.length && <div className="p-10 text-center text-sm text-muted-foreground">
                  {leads.length ? "No leads match these filters." : "No qualified companies were returned. See the explanation above."}
                </div>}
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">Emails are marked verified only when verification evidence is available. Review the sources before reaching out.</p>
            </section>
          )}
          <details className="mt-10 border-t pt-5">
            <summary className="cursor-pointer text-xs text-muted-foreground">Run details &amp; reported usage</summary>
            <div className="mt-4 space-y-3 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2"><span className="break-all font-mono">{runId}</span>
                <Button variant="ghost" size="icon-xs" aria-label="Copy run ID" onClick={copyId}>{copied ? <Check /> : <Copy />}</Button>
                {copyError && <span role="status">Copy unavailable. Select the ID to copy it.</span>}
              </div>
              {run && <>
                <p>Stop reason: {run.stopReason?.replaceAll("_", " ") ?? "Not reported"}</p>
                <p>Exa reported research cost: {formatCost(run.costDollars.exaAgentReported?.total)}</p>
                <p>Exa reported website cost: {formatCost(run.costDollars.exaWebsiteReported?.total)}</p>
                <p>AI token usage: {run.usage.ai.tokens?.totalTokens?.toLocaleString() ?? "Not reported"}{run.usage.ai.tokens ? " tokens" : ""}</p>
              </>}
            </div>
          </details>
        </>
      )}
    </main>
  );
}
