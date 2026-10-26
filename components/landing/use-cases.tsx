"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { LatticePanel } from "./shared";

const cases = [
  {
    who: "Founders",
    title: "Land your first 100 customers without hiring a sales team.",
    body: "You’re building the product and doing sales at night. Skip the research and spend that time on calls with people who actually need what you built.",
    points: ["Leads tonight, from just your website", "A reason to reach out and drafts to send", "Your first 10 leads are free"],
    prompt: "Find customers for https://ledgerly.dev. Only seed-stage fintechs in the US.",
    profile: "US fintech startups at seed stage, 5–40 people, building their first finance team.",
    rows: [["Brightpay", "Hiring a first Head of Finance"], ["Kestrel Money", "“We just closed our seed round.”"]],
  },
  {
    who: "Sales teams",
    title: "Fill every rep’s pipeline with accounts worth calling.",
    body: "Your reps spend hours researching accounts that go nowhere. Give them companies that need you this week, and a reason to call that gets a reply.",
    points: ["A three-email sequence for every account", "The decision-maker, not the whole org chart", "Up to 50 accounts per search, exported to CSV"],
    prompt: "Find customers for https://haulwise.com. Mid-market logistics, hiring ops managers.",
    profile: "Logistics and 3PL companies with 200–2,000 staff that are growing their operations team.",
    rows: [["Northgate Freight", "Hiring 3 Operations Managers"], ["Corbel Logistics", "“Opening a second hub in Ohio.”"]],
  },
  {
    who: "Agencies",
    title: "Deliver lead lists your clients can’t get anywhere else.",
    body: "Run a search from each client’s website and hand over leads with proof attached. Clients see why every lead fits, and you stop losing hours to manual research.",
    points: ["One search per client, in minutes", "Proof your clients can see", "Rejected companies shown with a reason"],
    prompt: "Find customers for https://smileflow.io. Dental groups with 5+ clinics in Texas.",
    profile: "Dental service organisations in Texas with five or more clinics and a central operations team.",
    rows: [["Lone Star Dental Group", "“Now 11 clinics across Texas.”"], ["Bluebonnet Smiles", "Hiring a Patient Experience Lead"]],
  },
];

export function UseCases() {
  const [active, setActive] = useState(0);
  const current = cases[active];

  return (
    <div>
      <div role="tablist" aria-label="Use cases" className="grid grid-cols-3 border-y border-zinc-200 bg-white">
        {cases.map((item, index) => (
          <button
            key={item.who} type="button" role="tab" id={`case-tab-${index}`} aria-selected={index === active} aria-controls="case-panel"
            onClick={() => setActive(index)}
            className={`relative h-14 border-r border-zinc-200 text-[14px] font-medium tracking-[-0.01em] transition-colors last:border-r-0 sm:text-[15px] ${index === active ? "text-zinc-950" : "text-zinc-600 hover:text-zinc-900"}`}
          >
            {item.who}
            {index === active && <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 bg-[#b3277d]" />}
          </button>
        ))}
      </div>

      <div id="case-panel" role="tabpanel" aria-labelledby={`case-tab-${active}`} className="grid lg:grid-cols-2">
        <div key={active} className="animate-in fade-in px-6 py-12 duration-300 sm:px-11 lg:py-16">
          <h3 className="max-w-md text-[28px] leading-[1.15] font-medium tracking-[-0.03em] sm:text-[32px]">{current.title}</h3>
          <p className="mt-4 max-w-md text-[16px] leading-7 text-zinc-700">{current.body}</p>
          <ul className="mt-8 space-y-3">
            {current.points.map((point) => (
              <li key={point} className="flex gap-2.5 text-[15px] text-zinc-800"><Check className="mt-0.5 size-4 shrink-0 text-[#3448d6]" strokeWidth={2.5} />{point}</li>
            ))}
          </ul>
        </div>
        <LatticePanel tone="amber" className="min-h-[400px] border-t border-zinc-200 lg:border-t-0 lg:border-l">
          <div key={active} className="animate-in fade-in slide-in-from-bottom-2 flex h-full items-center justify-center px-6 py-12 duration-500">
            <div className="w-full max-w-[400px] space-y-3">
              <div className="rounded-xl bg-zinc-950 px-4 py-3 font-mono text-[12px] leading-5 text-zinc-200 shadow-lg">
                <span className="text-zinc-500">› </span>{current.prompt}
              </div>
              <div className="overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_-20px_rgba(9,9,11,0.45)]">
                <div className="px-4 pt-4 pb-3">
                  <p className="text-[11px] font-medium text-zinc-500">Ideal customer</p>
                  <p className="mt-1.5 text-[13px] leading-5 text-zinc-900">{current.profile}</p>
                </div>
                {current.rows.map(([company, signal]) => (
                  <div key={company} className="flex items-center justify-between gap-4 border-t border-zinc-100 px-4 py-3">
                    <p className="truncate text-[13px] font-medium text-zinc-950">{company}</p>
                    <p className="truncate text-[12px] text-zinc-500">{signal}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </LatticePanel>
      </div>
    </div>
  );
}
