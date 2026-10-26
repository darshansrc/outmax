"use client";

import { useEffect, useState } from "react";
import { Check, Globe } from "lucide-react";
import { Emblem } from "@/components/brand/logo";
import { LatticePanel } from "./shared";

type Lead = { company: string; domain: string; signal: string; contact: string; role: string; email: "verified" | "unverified" | "none" };

const leads: Lead[] = [
  { company: "Hartwell & Pryce LLP", domain: "hartwellpryce.com", signal: "“Our BD team prepares the firm’s Chambers and Legal 500 submissions.”", contact: "Eleanor Shaw", role: "Head of Business Development", email: "verified" },
  { company: "Ostrander Vale", domain: "ostrandervale.co.uk", signal: "Hiring a Directories & Awards Manager", contact: "Priya Nair", role: "Director of Marketing", email: "unverified" },
  { company: "Maddox Kerr", domain: "maddoxkerr.com", signal: "“Ranked in 14 practice areas in The Legal 500 2026.”", contact: "Callum Reid", role: "Marketing Director", email: "verified" },
  { company: "Linde Holm Advokat", domain: "lindeholm.se", signal: "“Submissions season is our busiest quarter.”", contact: "Sara Lind", role: "Head of Marketing", email: "verified" },
  { company: "Beaumont Ashby", domain: "beaumontashby.com", signal: "Hiring a BD Executive, Rankings & Awards", contact: "Tom Ashby", role: "Partner, Business Development", email: "none" },
  { company: "Corwin Tate LLP", domain: "corwintate.com", signal: "“We submit to Chambers USA across six practice groups.”", contact: "Dana Ruiz", role: "Chief Marketing Officer", email: "verified" },
];

const columns = "md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_minmax(0,1.1fr)_96px]";

export function HeroDemo() {
  const [count, setCount] = useState(leads.length);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    const tick = (next: number) => {
      setCount(next);
      timer = window.setTimeout(() => tick(next === leads.length ? 0 : next + 1), next === leads.length ? 5200 : next === 0 ? 900 : 1100);
    };
    timer = window.setTimeout(() => tick(0), 2400);
    return () => window.clearTimeout(timer);
  }, []);

  const running = count < leads.length;

  return (
    <LatticePanel tone="blue" className="border-t border-zinc-200">
      <div className="px-3 pt-10 sm:px-10 sm:pt-14">
        <div className="overflow-hidden rounded-t-xl bg-white shadow-[0_30px_80px_-24px_rgba(9,9,11,0.55)]">
          <div className="flex h-12 items-center justify-between gap-4 border-b border-zinc-200 px-4">
            <div className="flex min-w-0 items-center gap-2.5 text-[13px]">
              <Emblem className="size-4.5 shrink-0 text-zinc-950" />
              <span className="hidden text-zinc-400 sm:inline">Searches</span>
              <span className="hidden text-zinc-300 sm:inline">/</span>
              <span className="truncate font-medium text-zinc-950">rankingcopilot.com</span>
            </div>
            <span className="inline-flex h-7 shrink-0 items-center gap-2 rounded-full border border-zinc-200 px-2.5 text-[12px] font-medium text-zinc-700 tabular-nums">
              {running
                ? <><span className="size-3 animate-spin rounded-full border-[1.5px] border-zinc-300 border-t-zinc-900" />Searching · {count} found</>
                : <><span className="size-1.5 rounded-full bg-emerald-500" />Done · 18 companies · $3.42</>}
            </span>
          </div>

          <div className="grid md:grid-cols-[230px_minmax(0,1fr)]">
            <aside className="hidden border-r border-zinc-200 p-4 md:block">
              <p className="text-[11px] font-medium text-zinc-500">Ideal customer</p>
              <p className="mt-2 text-[13px] leading-5 text-zinc-900">Law firms of 20–500 lawyers that prepare their own legal directory submissions.</p>
              <dl className="mt-4 space-y-2 border-t border-zinc-100 pt-4 text-[12px]">
                {[["Region", "UK, US, Nordics"], ["Buyer", "Head of BD"], ["Signal", "Directory submissions"]].map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-2"><dt className="text-zinc-500">{key}</dt><dd className="truncate font-medium text-zinc-800">{value}</dd></div>
                ))}
              </dl>
              <div className="mt-5 rounded-lg border border-zinc-200 px-3 py-2 text-[12px] text-zinc-400">Steer this search…</div>
            </aside>

            <div className="min-w-0">
              <div className={`hidden h-9 items-center gap-4 border-b border-zinc-200 px-4 text-[11px] font-medium text-zinc-500 md:grid ${columns}`}>
                <span>Company</span><span>Why they fit</span><span>Decision-maker</span><span>Email</span>
              </div>
              <ul className="h-[372px] md:h-[360px]">
                {leads.slice(0, count).map((lead) => (
                  <li key={lead.company} className={`animate-in fade-in slide-in-from-bottom-1 grid h-[62px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-zinc-100 px-4 duration-500 md:h-[60px] ${columns}`}>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-zinc-950">{lead.company}</p>
                      <p className="hidden truncate font-mono text-[11px] text-zinc-400 md:block">{lead.domain}</p>
                      <p className="truncate text-[11px] text-zinc-500 md:hidden">{lead.signal}</p>
                    </div>
                    <p className="hidden truncate text-[12px] text-zinc-600 md:block">{lead.signal}</p>
                    <div className="hidden min-w-0 md:block">
                      <p className="truncate text-[13px] text-zinc-900">{lead.contact}</p>
                      <p className="truncate text-[11px] text-zinc-500">{lead.role}</p>
                    </div>
                    <EmailState state={lead.email} />
                  </li>
                ))}
                {running && (
                  <li className="flex h-[60px] items-center gap-2 px-4 text-[12px] text-zinc-400">
                    <Globe className="size-3.5" />Reviewing the next company…
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </LatticePanel>
  );
}

function EmailState({ state }: { state: Lead["email"] }) {
  if (state === "verified") return <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-700"><Check className="size-3.5" strokeWidth={2.5} />Verified</span>;
  if (state === "unverified") return <span className="text-[12px] text-zinc-500">Unverified</span>;
  return <span className="text-[12px] text-zinc-400">Not found</span>;
}
