"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { ArrowUpRight, Check, ChevronDown, ChevronUp, Copy, Globe, Mail, X } from "lucide-react";
import { cn } from "cn";
import { Button, Input, Textarea } from "@/components/brand/controls";
import { ENGINE_LABELS, type DraftEmail, type Lead, type OnboardingRun, type RunUsage, type TokenUsage } from "@/lib/onboarding";
import { Favicon, Flag, LinkedInLogo } from "./icons";
import { RecentSearches, idealCustomer } from "./setup";
import { PanelLabel, Pill, Shell, Spinner, formatDate, hostname } from "./shell";

const active = (status: string) => status === "queued" || status === "running";
const columns = [
  "md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_88px_84px]",
  "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(0,0.8fr)_88px_84px]",
  "xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(0,0.8fr)_88px_84px]",
].join(" ");

function useRun(runId: string) {
  const [run, setRun] = useState<OnboardingRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState({ count: 0, retryDrafts: false });

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load(method: "GET" | "POST" = "GET") {
      try {
        const path = `/api/onboarding/runs/${encodeURIComponent(runId)}${method === "POST" ? "/drafts" : ""}`;
        const response = await fetch(path, { method, cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "We couldn’t load this search.");
        setRun(body);
        setError(null);
        if (active(body.status) || body.drafts?.status === "pending") {
          timer = setTimeout(() => void load(), active(body.status) ? 5_000 : 3_000);
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "We couldn’t load this search.");
      }
    }
    void load(request.retryDrafts ? "POST" : "GET");
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [runId, request]);

  return {
    run, error,
    reload: () => setRequest(({ count }) => ({ count: count + 1, retryDrafts: false })),
    retryDrafts: () => setRequest(({ count }) => ({ count: count + 1, retryDrafts: true })),
  };
}

export function RunPage() {
  const { runId } = useParams<{ runId: string }>();
  return <RunView key={runId} runId={runId} />;
}

function RunView({ runId }: { runId: string }) {
  const { run, error, reload, retryDrafts } = useRun(runId);
  const [open, setOpen] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const count = run?.leads.length ?? 0;

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (open === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") return setOpen(null);
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        setOpen((value) => (value === null ? value : Math.min(value + 1, count - 1)));
      } else if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        setOpen((value) => (value === null ? value : Math.max(value - 1, 0)));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, count]);

  const label = run ? hostname(run.website) : "Search";
  const newSearch = <Button href="/onboarding" variant="secondary" size="sm" className="h-8 px-3 text-[13px]">New search</Button>;

  if (!run) {
    return (
      <Shell crumb={label} actions={newSearch} aside={<RecentSearches activeRunId={runId} />}>
        <div className="px-6 py-10 sm:px-10">
          {error ? (
            <Message title="We couldn’t load this search" text={error} alert><Button size="sm" onClick={reload}>Try again</Button></Message>
          ) : (
            <p className="flex items-center gap-2 text-[13px] text-zinc-500"><Spinner />Loading search…</p>
          )}
        </div>
      </Shell>
    );
  }

  const leads = run.leads;
  const withEmail = leads.filter((lead) => lead.workEmail).length;
  const verified = leads.filter((lead) => lead.emailVerificationStatus === "verified").length;
  const minutes = run.createdAt && now ? Math.max(0, Math.round((now - new Date(run.createdAt).getTime()) / 60_000)) : null;
  const retry = `/onboarding?site=${encodeURIComponent(label)}`;
  const openLead = open !== null ? leads[open] : undefined;
  const progress = run.progress;

  const status = active(run.status)
    ? <Pill><Spinner />Searching{minutes ? ` · ${minutes} min` : ""}</Pill>
    : run.status === "completed"
      ? <Pill><span className="size-1.5 rounded-full bg-emerald-500" />Done · {leads.length} {leads.length === 1 ? "company" : "companies"}</Pill>
      : <Pill><span className="size-1.5 rounded-full bg-red-500" />{run.status === "cancelled" ? "Cancelled" : "Failed"}</Pill>;

  return (
    <Shell crumb={label} status={status} actions={newSearch} aside={<RunPanel run={run} runId={runId} />}>
      {error && <p role="alert" className="border-b border-red-100 bg-red-50 px-5 py-2 text-[13px] text-red-700">{error}</p>}

      {!active(run.status) && run.status !== "completed" && (
        <div className="px-6 py-10 sm:px-10">
          <Message title="This search didn’t finish" text={run.error ?? "Please try again."} alert><Button href={retry} size="sm">Start again</Button></Message>
        </div>
      )}

      {run.status === "completed" && !leads.length && (
        <div className="px-6 py-10 sm:px-10">
          <Message title="No companies matched with enough evidence" text={run.shortfallReason ?? "Try loosening your must-haves or adding industries."}>
            <Button href={retry} size="sm">Edit and search again</Button>
          </Message>
        </div>
      )}

      {(active(run.status) || leads.length > 0) && (
        <>
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-2">
            <p className="text-[13px] text-zinc-600">
              {active(run.status)
                ? progress
                  ? <><span className="font-medium text-zinc-950">{progress.accepted}</span> of {run.leadCount} passed · <span className="font-medium text-zinc-950">{progress.checked}</span> checked · <span className="font-medium text-zinc-950">{progress.rejected.length}</span> rejected</>
                  : "Searching for companies that match your ideal customer. Usually 5–10 minutes."
                : <><span className="font-medium text-zinc-950">{leads.length}</span> companies · <span className="font-medium text-zinc-950">{withEmail}</span> with email · <span className="font-medium text-zinc-950">{verified}</span> verified</>}
            </p>
            {leads.length > 0 && <Button variant="secondary" size="sm" className="h-8 px-3 text-[13px]" onClick={() => exportCsv(run)}>Export CSV</Button>}
          </div>

          <div className={`sticky top-14 z-10 hidden h-9 items-center gap-4 border-b border-zinc-200 bg-white px-5 text-[11px] font-medium text-zinc-500 md:grid lg:top-0 ${columns}`}>
            <span>Company</span><span className="hidden xl:block">Why they fit</span><span>Decision-maker</span>
            <span className="hidden lg:block">Location</span><span>Email</span><span className="sr-only">Details</span>
          </div>

          <ul aria-label="Leads">
            {leads.map((lead, index) => (
              <li
                key={`${lead.companyName}-${index}`} onClick={() => setOpen(index)}
                className={cn(
                  `grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-zinc-100 px-5 py-3 transition-colors ${columns}`,
                  open === index ? "bg-zinc-50" : "hover:bg-zinc-50/70",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Favicon url={lead.website} className="size-5" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-zinc-950">{lead.companyName}</p>
                    <p className="hidden truncate font-mono text-[11px] text-zinc-400 md:block">{lead.website ? hostname(lead.website) : "—"}</p>
                    <p className="truncate text-[11px] text-zinc-500 md:hidden">{lead.contactName ?? "No contact found"}</p>
                  </div>
                </div>
                <p className="hidden text-[12px] leading-[18px] text-zinc-600 xl:line-clamp-2">{lead.fitExplanation}</p>
                <div className="hidden min-w-0 md:block">
                  <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-zinc-900">
                    <span className="truncate">{lead.contactName ?? <span className="text-zinc-400">Not found</span>}</span>
                    {lead.linkedInUrl && (
                      <a
                        href={lead.linkedInUrl} target="_blank" rel="noreferrer" aria-label={`${lead.contactName ?? "Contact"} on LinkedIn`}
                        onClick={(event) => event.stopPropagation()} className="shrink-0 opacity-80 transition-opacity hover:opacity-100"
                      >
                        <LinkedInLogo className="size-3.5" />
                      </a>
                    )}
                  </p>
                  {lead.jobTitle && <p className="truncate text-[11px] text-zinc-500">{lead.jobTitle}</p>}
                </div>
                <p className="hidden min-w-0 items-center gap-2 text-[12px] text-zinc-600 lg:flex">
                  {lead.location ? <><Flag location={lead.location} /><span className="truncate">{lead.location}</span></> : <span className="text-zinc-400">—</span>}
                </p>
                <div className="hidden md:block"><EmailState lead={lead} /></div>
                <Button
                  variant="secondary" size="sm" aria-label={`Open ${lead.companyName ?? "lead"}`}
                  onClick={(event) => { event.stopPropagation(); setOpen(index); }}
                  className="h-7 gap-1.5 justify-self-end px-2.5 text-[12px]"
                >
                  <Mail className="size-3.5" />Emails
                </Button>
              </li>
            ))}
            {active(run.status) && (
              <li className="flex h-[60px] min-w-0 items-center gap-2 border-b border-zinc-100 px-5 text-[12px] text-zinc-400">
                <Globe className="size-3.5 shrink-0" /><span className="truncate">{progress ? `${progress.stage}…` : "Reviewing companies…"}</span>
              </li>
            )}
          </ul>

          {run.status === "completed" && run.shortfallReason && (
            <p className="px-5 py-4 text-[12px] leading-[18px] text-zinc-500">{run.shortfallReason}</p>
          )}

          {progress && progress.rejected.length > 0 && <Rejected rows={progress.rejected} />}
        </>
      )}

      {openLead && open !== null && (
        <LeadPanel
          key={open} lead={openLead} index={open} total={leads.length} drafts={run.drafts}
          onClose={() => setOpen(null)} onMove={setOpen} onRetryDrafts={retryDrafts}
        />
      )}
    </Shell>
  );
}

function Rejected({ rows }: { rows: NonNullable<OnboardingRun["progress"]>["rejected"] }) {
  return (
    <details className="group border-t border-zinc-200">
      <summary className="flex h-11 cursor-pointer list-none items-center gap-2 px-5 text-[12px] text-zinc-500 hover:text-zinc-950 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-3.5 -rotate-90 transition-transform group-open:rotate-0" />
        {rows.length} {rows.length === 1 ? "company" : "companies"} didn’t pass
      </summary>
      <ul aria-label="Rejected companies" className="pb-4">
        {rows.toReversed().map((row) => (
          <li key={row.website} className="grid grid-cols-[minmax(0,14rem)_minmax(0,1fr)] items-baseline gap-4 px-5 py-1.5 pl-[42px] text-[12px]">
            <a href={row.website} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-zinc-700 hover:text-zinc-950">
              <Favicon url={row.website} className="size-3.5 translate-y-0.5" /><span className="truncate">{row.companyName}</span>
            </a>
            <span className="text-zinc-500">{row.reason}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const dollars = (value: number) => `$${value < 0.1 && value > 0 ? value.toFixed(3) : value.toFixed(2)}`;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const joined = (...parts: (string | number | false)[]) => parts.filter(Boolean).join(" · ");

function tokens(usage: TokenUsage | null) {
  if (!usage?.modelCalls) return null;
  return {
    text: `${compact.format(usage.inputTokens)} in · ${compact.format(usage.outputTokens)} out`,
    title: `${plural(usage.modelCalls, "call")}. ${usage.inputTokens.toLocaleString()} input tokens (${usage.cachedInputTokens.toLocaleString()} cached), ${usage.outputTokens.toLocaleString()} output tokens.`,
  };
}

type UsageRow = { key: string; value: string; title?: string; strong?: boolean };

function Usage({ usage, live }: { usage: RunUsage; live: boolean }) {
  const search = tokens(usage.leadTokens);
  const drafts = tokens(usage.draftTokens);
  const rows = ([
    usage.totalDollars !== null && { key: "Total", value: `${dollars(usage.totalDollars)} est.`, strong: true },
    (usage.exaSearches > 0 || usage.exaSearchDollars > 0) && { key: "Exa search", value: joined(usage.exaSearches && plural(usage.exaSearches, "request"), dollars(usage.exaSearchDollars)) },
    (usage.exaAgentRuns > 0 || usage.exaAgentDollars > 0) && { key: "Exa agent", value: joined(usage.exaAgentRuns && plural(usage.exaAgentRuns, "run"), dollars(usage.exaAgentDollars)) },
    (usage.fiberLookups > 0 || usage.fiberCredits > 0) && { key: "Fiber", value: joined(usage.fiberLookups && plural(usage.fiberLookups, "lookup"), `${Math.round(usage.fiberCredits * 100) / 100} credits`) },
    search && { key: "AI · search", value: search.text, title: search.title },
    drafts && { key: "AI · drafts", value: drafts.text, title: drafts.title },
  ] as (UsageRow | false | null)[]).filter((row): row is UsageRow => !!row);
  if (!rows.length) return null;
  return (
    <div className="mt-4 border-t border-zinc-100 pt-4">
      <PanelLabel>{live ? "Usage so far" : "Usage"}</PanelLabel>
      <dl className="mt-2 space-y-2 text-[12px]">
        {rows.map((row) => (
          <div key={row.key} className="flex justify-between gap-3">
            <dt className="shrink-0 text-zinc-500">{row.key}</dt>
            <dd title={row.title} className={cn("truncate font-mono text-[11px] text-zinc-700", row.strong && "text-zinc-950")}>{row.value}</dd>
          </div>
        ))}
      </dl>
      {usage.totalDollars === null && (
        <p className="mt-2 text-[11px] leading-4 text-zinc-400">No total. It needs token counts and model and Fiber prices.</p>
      )}
    </div>
  );
}

function RunPanel({ run, runId }: { run: OnboardingRun; runId: string }) {
  const { business, profile } = run;
  const rows = [
    ["Region", profile.regions.join(", ") || "Anywhere"],
    ["Buyer", profile.buyerTitles[0] ?? "Best fit"],
    ["Signal", profile.buyingSignals[0] ?? null],
  ].filter((row): row is [string, string] => !!row[1]);
  const drafts = run.drafts?.status;
  return (
    <div>
      <PanelLabel>Ideal customer</PanelLabel>
      <p className="mt-2 text-[13px] leading-5 text-zinc-900">{idealCustomer(profile)}</p>
      <dl className="mt-4 space-y-2 border-t border-zinc-100 pt-4 text-[12px]">
        {rows.map(([key, value]) => (
          <div key={key} className="flex justify-between gap-3">
            <dt className="shrink-0 text-zinc-500">{key}</dt>
            <dd title={value} className="truncate font-medium text-zinc-800">{value}</dd>
          </div>
        ))}
      </dl>
      <dl className="mt-4 space-y-2 border-t border-zinc-100 pt-4 text-[12px]">
        <div className="flex justify-between gap-3"><dt className="text-zinc-500">Selling</dt><dd className="truncate font-medium text-zinc-800">{business.name}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-zinc-500">Started</dt><dd className="font-medium text-zinc-800">{run.createdAt ? formatDate(run.createdAt) : "—"}</dd></div>
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">Email drafts</dt>
          <dd className="font-medium text-zinc-800">{drafts === "ready" ? "Ready" : drafts === "failed" ? "Failed" : run.status === "completed" ? "Writing…" : "After search"}</dd>
        </div>
        <div className="flex justify-between gap-3"><dt className="text-zinc-500">Engine</dt><dd className="font-medium text-zinc-800">{ENGINE_LABELS[run.engine]}</dd></div>
      </dl>
      {run.usage && <Usage usage={run.usage} live={active(run.status)} />}
      <div className="mt-6 border-t border-zinc-100 pt-4"><RecentSearches activeRunId={runId} /></div>
    </div>
  );
}

function Message({ title, text, alert, children }: { title: string; text: string; alert?: boolean; children?: ReactNode }) {
  return (
    <div className="max-w-xl">
      <h1 className="text-[20px] font-medium tracking-[-0.02em]">{title}</h1>
      <p role={alert ? "alert" : undefined} className="mt-2 text-[14px] leading-6 text-zinc-600">{text}</p>
      {children && <div className="mt-5 flex gap-2">{children}</div>}
    </div>
  );
}

function EmailState({ lead }: { lead: Lead }) {
  if (!lead.workEmail) return <span className="text-[12px] text-zinc-400">Not found</span>;
  if (lead.emailVerificationStatus === "verified") {
    return <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-700"><Check className="size-3.5" strokeWidth={2.5} />Verified</span>;
  }
  if (lead.emailVerificationStatus === "invalid") return <span className="text-[12px] text-red-600">Invalid</span>;
  return <span className="text-[12px] text-zinc-500">{lead.emailVerificationStatus === "catch_all" ? "Catch-all" : "Unverified"}</span>;
}

function LeadPanel({ lead, index, total, drafts, onClose, onMove, onRetryDrafts }: {
  lead: Lead; index: number; total: number; drafts: OnboardingRun["drafts"];
  onClose: () => void; onMove: (index: number) => void; onRetryDrafts: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus({ preventScroll: true }), []);

  return (
    <>
      <div aria-hidden onClick={onClose} className="fixed inset-x-0 top-14 bottom-0 z-30 bg-zinc-950/10" />
      <aside role="dialog" aria-label={lead.companyName ?? "Lead"} className="fixed top-14 right-0 bottom-0 z-40 flex w-full flex-col border-l border-zinc-200 bg-white sm:w-[600px]">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 px-3">
          <div className="flex items-center gap-1">
            <IconButton label="Previous lead" disabled={index === 0} onClick={() => onMove(index - 1)}><ChevronUp className="size-4" /></IconButton>
            <IconButton label="Next lead" disabled={index === total - 1} onClick={() => onMove(index + 1)}><ChevronDown className="size-4" /></IconButton>
            <span className="ml-1 text-[12px] text-zinc-500 tabular-nums">{index + 1} of {total}</span>
          </div>
          <IconButton ref={close} label="Close" onClick={onClose}><X className="size-4" /></IconButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex items-start gap-4 px-6 pt-6 pb-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white">
              <Favicon url={lead.website} className="size-6" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[20px] leading-7 font-medium tracking-[-0.02em]">{lead.companyName}</h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-zinc-500">
                {lead.website && (
                  <a href={lead.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-mono text-[11px] text-brand hover:underline">
                    {hostname(lead.website)}<ArrowUpRight className="size-3" />
                  </a>
                )}
                {lead.website && lead.location && <span aria-hidden className="text-zinc-300">·</span>}
                {lead.location && <span className="inline-flex items-center gap-1.5"><Flag location={lead.location} />{lead.location}</span>}
              </p>
            </div>
          </div>

          <PanelSection label="Why they fit">
            <p className="text-[14px] leading-6 text-zinc-800">{lead.fitExplanation}</p>
            {!!lead.sourceUrls?.length && (
              <ul className="mt-3 space-y-1.5">
                {lead.sourceUrls.map((url, sourceIndex) => (
                  <li key={`${url}-${sourceIndex}`}>
                    <a href={url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-brand hover:underline">
                      <Favicon url={url} className="size-3.5" />
                      <span className="truncate">{url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
                      <ArrowUpRight className="size-3 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </PanelSection>

          <PanelSection label="Decision-maker">
            {lead.contactName ? (
              <dl className="grid grid-cols-[80px_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13px]">
                <dt className="text-zinc-500">Name</dt><dd className="font-medium">{lead.contactName}</dd>
                <dt className="text-zinc-500">Title</dt><dd>{lead.jobTitle ?? <span className="text-zinc-400">Not found</span>}</dd>
                <dt className="text-zinc-500">Email</dt>
                <dd className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  {lead.workEmail ? <>
                    <span className="break-all">{lead.workEmail}</span>
                    <EmailState lead={lead} />
                    <CopyIcon text={lead.workEmail} />
                  </> : <span className="text-zinc-400">Not found</span>}
                </dd>
                {lead.linkedInUrl && <>
                  <dt className="text-zinc-500">LinkedIn</dt>
                  <dd>
                    <a href={lead.linkedInUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-zinc-900 hover:underline">
                      <LinkedInLogo />View profile<ArrowUpRight className="size-3 text-zinc-400" />
                    </a>
                  </dd>
                </>}
              </dl>
            ) : (
              <p className="text-[13px] leading-5 text-zinc-600">We couldn’t find a supported contact here. The emails are written to the role.</p>
            )}
          </PanelSection>

          <Drafts lead={lead} index={index} drafts={drafts} total={total} onRetry={onRetryDrafts} />
        </div>
      </aside>
    </>
  );
}

function PanelSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="border-t border-zinc-200 px-6 py-5">
      <PanelLabel className="mb-3">{label}</PanelLabel>
      {children}
    </section>
  );
}

const dayLabels: Record<number, string> = { 1: "Day 1 · First email", 3: "Day 3 · Follow-up", 7: "Day 7 · Last note" };

function Drafts({ lead, index, drafts, total, onRetry }: {
  lead: Lead; index: number; drafts: OnboardingRun["drafts"]; total: number; onRetry: () => void;
}) {
  const [day, setDay] = useState(0);
  const [edits, setEdits] = useState<Record<number, DraftEmail>>({});
  const [copied, setCopied] = useState(false);

  if (!drafts || drafts.status === "pending") {
    return (
      <PanelSection label="Emails">
        <p className="flex items-center gap-2 text-[13px] text-zinc-500"><Spinner />Writing emails for all {total} leads. About a minute.</p>
      </PanelSection>
    );
  }
  if (drafts.status === "failed") {
    return (
      <PanelSection label="Emails">
        <p role="alert" className="text-[13px] text-zinc-600">{drafts.error}</p>
        <Button size="sm" variant="secondary" className="mt-3 h-8 px-3 text-[13px]" onClick={onRetry}>Try again</Button>
      </PanelSection>
    );
  }

  const sequence = drafts.sequences[index];
  if (!sequence?.length) {
    return <PanelSection label="Emails"><p className="text-[13px] text-zinc-500">No emails were written for this lead.</p></PanelSection>;
  }
  const email = edits[day] ?? sequence[day];
  const edit = (patch: Partial<DraftEmail>) => setEdits((current) => ({ ...current, [day]: { ...email, ...patch } }));
  const mailto = `mailto:${lead.workEmail ?? ""}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1_500);
    } catch {}
  }

  return (
    <section className="border-t border-zinc-200">
      <div role="tablist" aria-label="Email in sequence" className="grid grid-cols-3 border-b border-zinc-200">
        {sequence.map((item, itemIndex) => (
          <button
            key={item.day} type="button" role="tab" aria-selected={itemIndex === day} onClick={() => setDay(itemIndex)}
            className={cn(
              "relative h-11 border-r border-zinc-200 text-[13px] font-medium tracking-[-0.01em] transition-colors last:border-r-0",
              itemIndex === day ? "text-zinc-950" : "text-zinc-500 hover:text-zinc-900",
            )}
          >
            {dayLabels[item.day] ?? `Day ${item.day}`}
            {itemIndex === day && <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 bg-[#b3277d]" />}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="space-y-3 px-6 py-5">
        <Input size="sm" aria-label="Subject" value={email.subject} onChange={(event) => edit({ subject: event.target.value })} />
        <Textarea aria-label="Body" rows={12} className="field-sizing-content min-h-60" value={email.body} onChange={(event) => edit({ body: event.target.value })} />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" className="h-8 px-3 text-[13px]" onClick={copy}>{copied ? "Copied" : "Copy email"}</Button>
          <Button href={mailto} variant="secondary" size="sm" className="h-8 px-3 text-[13px]">Open in email</Button>
          <span className="ml-auto text-[12px] text-zinc-500">{day === 0 ? "Send first." : `Send on day ${email.day} if there’s no reply.`}</span>
        </div>
      </div>
    </section>
  );
}

function IconButton({ label, className, ...props }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button" aria-label={label}
      className={cn("inline-flex size-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 disabled:pointer-events-none disabled:opacity-40", className)}
      {...props}
    />
  );
}

function CopyIcon({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      label="Copy email address" className="size-6"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1_500);
        } catch {}
      }}
    >
      {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
    </IconButton>
  );
}

function exportCsv(run: OnboardingRun) {
  const sequences = run.drafts?.status === "ready" ? run.drafts.sequences : {};
  const header = ["Company", "Website", "Location", "Why they fit", "Contact", "Title", "Email", "Email status", "LinkedIn",
    ...[1, 3, 7].flatMap((day) => [`Day ${day} subject`, `Day ${day} body`])];
  const rows = run.leads.map((lead, index) => [
    lead.companyName, lead.website, lead.location, lead.fitExplanation, lead.contactName, lead.jobTitle,
    lead.workEmail, lead.emailVerificationStatus, lead.linkedInUrl,
    ...(sequences[index] ?? []).flatMap((email) => [email.subject, email.body]),
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = `outmax-${hostname(run.website)}-leads.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
