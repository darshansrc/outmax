"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { cn } from "cn";
import { Button, Input, Label, TagInput, Textarea } from "@/components/brand/controls";
import { SiteForm } from "@/components/landing/site-form";
import { ENGINE_LABELS, LEAD_COUNT, sizeLabel, type Business, type Engine, type Profile } from "@/lib/onboarding";
import { ENGINE_NOTES, EngineButton } from "./engine-button";
import { Favicon } from "./icons";
import { rememberRun, useRecentRuns } from "./recent";
import { PanelLabel, Pill, Shell, Spinner, formatDate, hostname } from "./shell";

type Analysis = { website: string; business: Business; profile: Profile; pages: { url: string; title: string | null }[] };

export function Onboarding() {
  const site = useSearchParams().get("site");
  return site ? <Setup key={site} site={site} /> : <Start />;
}

const steps = [
  ["Paste your website", "We read your homepage and up to 5 key pages to learn what you sell."],
  ["Confirm your buyer", "Check the industries, roles and buying signals we drafted. Change anything."],
  ["Get leads and emails", "Up to 50 companies, each with a decision-maker and three email drafts."],
];

function Start() {
  return (
    <Shell aside={<RecentSearches />}>
      <div className="mx-auto max-w-[640px] px-6 pt-16 pb-14 text-center sm:pt-24">
        <h1 className="text-[32px] leading-[1.15] font-medium tracking-[-0.03em] sm:text-[40px]">Find companies ready to buy from you</h1>
        <p className="mx-auto mt-4 max-w-[30rem] text-[15px] leading-6 text-zinc-600">
          Paste your website. We work out who buys from you, you confirm it, and we find the companies and the person to email at each.
        </p>
        <div className="mt-8"><SiteForm center id="onboarding-url" /></div>
      </div>
      <ol className="grid border-y border-zinc-200 sm:grid-cols-3">
        {steps.map(([title, text], index) => (
          <li key={title} className="flex gap-3 border-b border-zinc-200 px-6 py-6 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0">
            <Marker n={index + 1} />
            <div>
              <h2 className="text-[14px] font-medium tracking-[-0.01em]">{title}</h2>
              <p className="mt-1 text-[13px] leading-5 text-zinc-600">{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </Shell>
  );
}

export function RecentSearches({ activeRunId }: { activeRunId?: string }) {
  const recent = useRecentRuns();
  return (
    <div>
      <PanelLabel>Recent searches</PanelLabel>
      {recent.length ? (
        <ul className="-mx-2 mt-2">
          {recent.map((run) => (
            <li key={run.runId}>
              <Link
                href={`/onboarding/${run.runId}`} aria-current={run.runId === activeRunId ? "page" : undefined}
                className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors", run.runId === activeRunId ? "bg-zinc-100" : "hover:bg-zinc-100")}
              >
                <Favicon url={run.website} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-zinc-900">{hostname(run.website)}</span>
                  <span className="block text-[11px] text-zinc-500">{formatDate(run.createdAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] leading-5 text-zinc-500">No searches yet.</p>
      )}
      <p className="mt-4 text-[11px] leading-4 text-zinc-400">Saved in this browser for 30 days.</p>
    </div>
  );
}

function Marker({ n }: { n: number }) {
  return (
    <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-[11px] font-semibold text-white tabular-nums">{n}</span>
  );
}

function Setup({ site }: { site: string }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/onboarding/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: site }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "We couldn’t read that website.");
        setAnalysis(body);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "We couldn’t read that website.");
      });
    return () => controller.abort();
  }, [site, attempt]);

  const label = hostname(site);

  if (error) {
    return (
      <Shell crumb={label} status={<Pill><span className="size-1.5 rounded-full bg-red-500" />Couldn’t read site</Pill>}>
        <div className="mx-auto max-w-[560px] px-6 py-20 text-center">
          <h1 className="text-[24px] font-medium tracking-[-0.025em]">We couldn’t read {label}</h1>
          <p role="alert" className="mt-3 text-[14px] leading-6 text-zinc-600">{error}</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button size="sm" onClick={() => { setError(null); setAttempt((value) => value + 1); }}>Try again</Button>
            <Button size="sm" variant="secondary" href="/onboarding">Use a different website</Button>
          </div>
        </div>
      </Shell>
    );
  }

  if (!analysis) {
    return (
      <Shell crumb={label} status={<Pill><Spinner />Reading site</Pill>} aside={<LoadingPanel />}>
        <div className="px-6 py-10 sm:px-10">
          <h1 className="text-[22px] font-medium tracking-[-0.025em]">Reading {label}</h1>
          <p className="mt-2 max-w-xl text-[14px] leading-6 text-zinc-600">
            We’re reading your homepage and up to 5 key pages, then drafting who buys from you. This takes about 15 seconds.
          </p>
          <div aria-hidden className="mt-10 border-t border-zinc-200">
            {[0, 1, 2].map((row) => (
              <div key={row} className="grid gap-6 border-b border-zinc-100 py-7 md:grid-cols-[200px_minmax(0,1fr)]">
                <div className="h-3.5 w-28 animate-pulse rounded bg-zinc-100" />
                <div className="space-y-3">
                  <div className="h-9 animate-pulse rounded-lg bg-zinc-100" />
                  <div className="h-9 w-2/3 animate-pulse rounded-lg bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  return <Review analysis={analysis} />;
}

function LoadingPanel() {
  return (
    <div aria-hidden>
      <PanelLabel>Ideal customer</PanelLabel>
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-zinc-100" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-zinc-100" />
      </div>
      <div className="mt-5 space-y-3 border-t border-zinc-100 pt-4">
        {[0, 1, 2].map((row) => <div key={row} className="h-3 animate-pulse rounded bg-zinc-100" />)}
      </div>
    </div>
  );
}

function Review({ analysis }: { analysis: Analysis }) {
  const router = useRouter();
  const [business, setBusiness] = useState(analysis.business);
  const [profile, setProfile] = useState(analysis.profile);
  const [senderName, setSenderName] = useState("");
  const [engine, setEngine] = useState<Engine>("outmax");
  const [leadCount, setLeadCount] = useState<number>(LEAD_COUNT.default);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const label = hostname(analysis.website);

  const editBusiness = <K extends keyof Business>(field: K) => (value: Business[K]) => setBusiness((current) => ({ ...current, [field]: value }));
  const editProfile = <K extends keyof Profile>(field: K) => (value: Profile[K]) => setProfile((current) => ({ ...current, [field]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business.name.trim() || !business.oneLiner.trim()) {
      setError("Add your company name and what you sell.");
      return;
    }
    if (!profile.industries.length && !profile.mustHaves.length) {
      setError("Add at least one industry or must-have so we know who to look for.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/onboarding/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: analysis.website, business, profile, senderName: senderName.trim() || null, engine, leadCount }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "We couldn’t start the search.");
      rememberRun({ runId: body.runId, website: analysis.website, createdAt: new Date().toISOString() });
      router.push(`/onboarding/${body.runId}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "We couldn’t start the search.");
      setPending(false);
    }
  }

  const aside = (
    <div>
      <PanelLabel>Ideal customer</PanelLabel>
      <p className="mt-2 text-[13px] leading-5 text-zinc-900">{idealCustomer(profile)}</p>
      <dl className="mt-4 space-y-2 border-t border-zinc-100 pt-4 text-[12px]">
        {[
          ["Region", profile.regions.join(", ") || "Anywhere"],
          ["Buyer", profile.buyerTitles[0] ?? "Best fit"],
          ["Signal", profile.buyingSignals[0] ?? "None"],
        ].map(([key, value]) => (
          <div key={key} className="flex justify-between gap-3">
            <dt className="shrink-0 text-zinc-500">{key}</dt>
            <dd title={value} className="truncate font-medium text-zinc-800">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <label htmlFor="lead-count" className="text-[12px] text-zinc-500">Leads to find</label>
          <LeadCount id="lead-count" value={leadCount} onChange={setLeadCount} />
        </div>
        <EngineButton form="profile" engine={engine} onEngine={setEngine} pending={pending} />
        <p role={error ? "alert" : undefined} className={cn("mt-2 text-[12px] leading-[18px]", error ? "text-red-600" : "text-zinc-500")}>
          {error ?? <><span className="font-medium text-zinc-700">{ENGINE_LABELS[engine]}.</span> {ENGINE_NOTES[engine]}</>}
        </p>
      </div>
      <PanelLabel className="mt-6 border-t border-zinc-100 pt-4">Pages we read</PanelLabel>
      <ul className="mt-2 space-y-1.5">
        {analysis.pages.map((page) => (
          <li key={page.url}>
            <a href={page.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 font-mono text-[11px] text-brand hover:underline">
              <span className="truncate">{page.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
              <ArrowUpRight className="size-3 shrink-0" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <Shell crumb={label} status={<Pill><span className="size-1.5 rounded-full bg-zinc-950" />Review</Pill>} aside={aside}>
      <form id="profile" onSubmit={submit} noValidate className="px-6 py-10 sm:px-10">
        <h1 className="text-[22px] font-medium tracking-[-0.025em]">Review your ideal customer</h1>
        <p className="mt-2 max-w-xl text-[14px] leading-6 text-zinc-600">
          We drafted this from {analysis.pages.length} {analysis.pages.length === 1 ? "page" : "pages"} on {label}. Fix anything that’s off. The search follows it exactly.
        </p>

        <div className="mt-8 border-t border-zinc-200">
          <Section title="Your business" description="Used to judge fit and write your emails.">
            <Field id="name" label="Company name">
              <Input id="name" size="sm" className="max-w-sm" value={business.name} onChange={(event) => editBusiness("name")(event.target.value)} />
            </Field>
            <Field id="one-liner" label="What you sell">
              <Textarea id="one-liner" rows={2} value={business.oneLiner} onChange={(event) => editBusiness("oneLiner")(event.target.value)} />
            </Field>
            <Field id="offerings" label="Products and services">
              <TagInput id="offerings" value={business.offerings} onChange={editBusiness("offerings")} placeholder="Type and press Enter" />
            </Field>
            <Pair>
              <Field id="customers" label="Customers named on your site" hint="Skipped, and used as examples of a good fit.">
                <TagInput id="customers" value={business.customersMentioned} onChange={editBusiness("customersMentioned")} placeholder="Acme Corp" />
              </Field>
              <Field id="competitors" label="Competitors" hint="Skipped.">
                <TagInput id="competitors" value={business.competitors} onChange={editBusiness("competitors")} placeholder="Competitor name" />
              </Field>
            </Pair>
          </Section>

          <Section title="Who buys from you" description="The companies the search looks for.">
            <Field id="ideal-customer" label="Ideal customer" hint="In your words: their stage, size and why they’d pick you. The search judges every company against this.">
              <Textarea id="ideal-customer" rows={3} className="field-sizing-content min-h-20" value={profile.idealCustomer ?? ""} onChange={(event) => editProfile("idealCustomer")(event.target.value)}
                placeholder="Indie and early-stage SaaS teams who want to charge globally without setting up billing, tax and compliance themselves." />
            </Field>
            <Pair>
              <Field id="industries" label="Industries">
                <TagInput id="industries" value={profile.industries} onChange={editProfile("industries")} placeholder="Law firms" />
              </Field>
              <Field id="regions" label="Regions">
                <TagInput id="regions" value={profile.regions} onChange={editProfile("regions")} placeholder="United Kingdom" />
              </Field>
            </Pair>
            <Field id="size-min" label="Company size" hint="Employees. Leave blank for any size.">
              <div className="flex items-center gap-2">
                <Input id="size-min" size="sm" type="number" min={1} inputMode="numeric" placeholder="Min" className="w-28"
                  value={profile.companySizeMin ?? ""} onChange={(event) => editProfile("companySizeMin")(toSize(event.target.value))} />
                <span className="text-[13px] text-zinc-500">to</span>
                <Input id="size-max" size="sm" type="number" min={1} inputMode="numeric" placeholder="Max" aria-label="Maximum employees" className="w-28"
                  value={profile.companySizeMax ?? ""} onChange={(event) => editProfile("companySizeMax")(toSize(event.target.value))} />
              </div>
            </Field>
            <Field id="signals" label="Buying signals" hint="Public events that show a company needs you now.">
              <TagInput id="signals" value={profile.buyingSignals} onChange={editProfile("buyingSignals")} placeholder="Hiring a marketing manager" />
            </Field>
            <Pair>
              <Field id="must-haves" label="Must-haves" hint="Every company has to meet all of these.">
                <TagInput id="must-haves" value={profile.mustHaves} onChange={editProfile("mustHaves")} placeholder="Has a sales team" />
              </Field>
              <Field id="not-a-fit" label="Not a fit" hint="Looks relevant but won’t buy.">
                <TagInput id="not-a-fit" value={profile.notAFit ?? []} onChange={editProfile("notAFit")} placeholder="Enterprises with in-house billing" />
              </Field>
            </Pair>
            <Field id="exclusions" label="Leave out" hint="Companies or types of company to skip.">
              <TagInput id="exclusions" value={profile.exclusions} onChange={editProfile("exclusions")} placeholder="Agencies" />
            </Field>
          </Section>

          <Section title="Decision-maker" description="The person we find at each company.">
            <Field id="titles" label="Job titles">
              <TagInput id="titles" value={profile.buyerTitles} onChange={editProfile("buyerTitles")} placeholder="Head of Marketing" />
            </Field>
          </Section>

          <Section title="Email drafts" description="A first email plus follow-ups on day 3 and day 7.">
            <Field id="sender" label="Your name" hint="Optional. Used to sign the drafts.">
              <Input id="sender" size="sm" autoComplete="name" placeholder="Jane Smith" className="max-w-sm" value={senderName} onChange={(event) => setSenderName(event.target.value)} />
            </Field>
          </Section>
        </div>

        <div className="mt-8 flex items-center gap-3 lg:hidden">
          <LeadCount id="lead-count-mobile" value={leadCount} onChange={setLeadCount} aria-label="Leads to find" />
          <EngineButton form="profile" engine={engine} onEngine={setEngine} pending={pending} className="w-56" />
          {error && <p role="alert" className="text-[13px] text-red-600">{error}</p>}
        </div>
      </form>
    </Shell>
  );
}

export function idealCustomer(profile: Profile) {
  const industries = profile.industries.length ? profile.industries.join(", ") : "Companies";
  const size = sizeLabel(profile);
  return `${industries}${size ? ` with ${size.toLowerCase()}` : ""}.`;
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid gap-x-10 gap-y-5 border-b border-zinc-200 py-8 md:grid-cols-[200px_minmax(0,1fr)]">
      <div>
        <h2 className="text-[14px] font-medium tracking-[-0.01em]">{title}</h2>
        <p className="mt-1 text-[13px] leading-5 text-zinc-500">{description}</p>
      </div>
      <div className="max-w-[720px] space-y-5">{children}</div>
    </section>
  );
}

const leadCounts = [5, 10, 15, 20, 25, 30, 40, 50].filter((count) => count >= LEAD_COUNT.min && count <= LEAD_COUNT.max);

export function LeadCount({ value, onChange, max = LEAD_COUNT.max, prefix = "", ...props }: { id: string; value: number; onChange: (value: number) => void; max?: number; prefix?: string; "aria-label"?: string }) {
  return (
    <div className="relative">
      <select
        {...props}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8 appearance-none rounded-lg border border-zinc-300 bg-white pr-7 pl-2.5 text-[13px] font-medium text-zinc-950 outline-none hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
      >
        {leadCounts.filter((count) => count <= max).map((count) => <option key={count} value={count}>{prefix}{count}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-zinc-500" />
    </div>
  );
}

function Pair({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 xl:grid-cols-2">{children}</div>;
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <Label htmlFor={id}>{label}</Label>
      {hint && <p className="mt-0.5 text-[12px] text-zinc-500">{hint}</p>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function toSize(value: string) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : null;
}
