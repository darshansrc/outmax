import Link from "next/link";
import { ArrowUpRight, Award, Briefcase, Check, Mic, Newspaper, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/brand/controls";
import { Wordmark } from "@/components/brand/logo";
import { HeroDemo } from "./hero-demo";
import { SiteForm } from "./site-form";
import { UseCases } from "./use-cases";
import { Box, Connector, Hatch, LatticePanel, Plus, type panelTones } from "./shared";

export function Landing() {
  return (
    <div className={`flex min-h-full flex-1 flex-col bg-[#f7f7f8] font-sans text-zinc-950 antialiased`}>
      <Nav />
      <main className="flex-1 pb-16">
        <Hero />
        <Connector />
        <Anatomy />
        <Connector />
        <HowItWorks />
        <Connector />
        <Signals />
        <Connector />
        <Box id="use-cases">
          <SectionHead title="More meetings, whoever is doing the selling." accent="Founders, sales teams and agencies use the same search." />
          <UseCases />
        </Box>
        <Connector />
        <ExampleSearch />
        <Connector />
        <Pricing />
        <Connector />
        <Faq />
        <Connector />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}

function Nav() {
  const links = [["Product", "#product"], ["How it works", "#how"], ["Use cases", "#use-cases"], ["Pricing", "#pricing"], ["FAQ", "#faq"]];
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1080px] items-center justify-between px-5 sm:px-0">
        <Wordmark className="text-zinc-950" />
        <nav aria-label="Sections" className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 lg:flex">
          {links.map(([label, href]) => (
            <a key={href} href={href} className="text-[14px] font-medium tracking-[-0.01em] text-zinc-600 transition-colors hover:text-zinc-950">{label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button href="/login" variant="ghost" size="sm" className="hidden px-3 sm:inline-flex">Log in</Button>
          <Button href="/onboarding" size="sm">Get free leads</Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <Box className="border-t-0">
      <Plus className="-bottom-[5px] -left-[5px] z-10 hidden sm:block" />
      <Plus className="-right-[5px] -bottom-[5px] z-10 hidden sm:block" />
      <div className="px-6 pt-16 pb-14 text-center sm:px-11 sm:pt-24 sm:pb-16">
        <p className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1 pr-3 pl-1 text-[13px] font-medium tracking-[-0.01em] text-zinc-600">
          <span className="rounded-full bg-[#3448d6]/10 px-2 py-0.5 text-[12px] font-semibold text-[#3448d6]">Free</span>
          Your first 10 leads are on us
        </p>
        <h1 className="mx-auto mt-6 max-w-[720px] text-[40px] leading-[1.1] font-medium tracking-[-0.035em] text-zinc-950 sm:text-[52px]">
          Find companies ready to buy from you this week
        </h1>
        <p className="mx-auto mt-5 max-w-[34rem] text-[16px] leading-6 text-zinc-700">
          Paste your website. We work out who really buys from you, find companies that fit and check each one. You get the decision-maker, their email and three drafts ready to send.
        </p>
        <div className="mt-9"><SiteForm center /></div>
      </div>
      <div id="product" className="scroll-mt-20"><HeroDemo /></div>
      <Hatch />
    </Box>
  );
}

function SectionHead({ title, accent, className = "" }: { title: React.ReactNode; accent?: string; className?: string }) {
  return (
    <div className={`px-6 pt-16 pb-12 sm:px-11 sm:pt-20 ${className}`}>
      <h2 className="max-w-3xl text-[32px] leading-[1.15] font-medium tracking-[-0.03em] text-zinc-950 sm:text-[40px]">
        {title}{accent && <> <span className="text-zinc-600">{accent}</span></>}
      </h2>
    </div>
  );
}

function Marker({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span aria-hidden className={`flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-[11px] font-semibold text-white tabular-nums ${className}`}>{n}</span>
  );
}

function Anatomy() {
  const parts = [
    ["A company that fits", "Right kind of business, right size, right market. Not a giant that outgrew what you sell."],
    ["A reason to reach out today", "They’re hiring for it, investing in it or talking about it publicly."],
    ["Proof you can check", "A quote from the exact page we found it on, so you never pitch on a guess."],
    ["The person who signs off", "Not a junior employee. The one who owns the budget, with their LinkedIn."],
    ["An email, and what to say", "Marked verified when it passes a deliverability check. Plus a three-email sequence written for them."],
  ];
  return (
    <Box>
      <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="px-6 py-16 sm:px-11 sm:py-20">
          <h2 className="text-[32px] leading-[1.15] font-medium tracking-[-0.03em] sm:text-[40px]">
            Cold lists don’t book meetings. <span className="text-zinc-600">Good timing does.</span>
          </h2>
          <p className="mt-5 max-w-md text-[16px] leading-7 text-zinc-700">Most people on a bought list have no reason to talk to you. Every Outmax lead comes with five things a contact database can’t give you.</p>
          <ol className="mt-8 border-t border-zinc-200">
            {parts.map(([title, body], index) => (
              <li key={title} className="flex gap-4 border-b border-zinc-200 py-4">
                <Marker n={index + 1} className="mt-0.5" />
                <p className="text-[15px] leading-6 text-zinc-700"><span className="block font-medium text-zinc-950">{title}</span>{body}</p>
              </li>
            ))}
          </ol>
        </div>
        <LatticePanel tone="magenta" className="min-h-[520px] border-t border-zinc-200 lg:border-t-0 lg:border-l">
          <div className="flex h-full items-center justify-center px-6 py-14 sm:px-12">
            <article className="w-full max-w-[420px] rounded-2xl bg-white p-2 shadow-[0_30px_80px_-24px_rgba(9,9,11,0.55)]">
              <div className="flex items-start gap-3 p-3">
                <Marker n={1} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium tracking-[-0.01em] text-zinc-950">Hartwell & Pryce LLP</p>
                  <p className="mt-0.5 text-[12px] text-zinc-500">London · 140 lawyers · Law firm</p>
                </div>
              </div>
              <div className="flex gap-3 rounded-xl bg-zinc-50 p-3">
                <Marker n={2} className="mt-0.5" />
                <p className="border-l-2 border-[#b3277d] pl-3 text-[13px] leading-5 text-zinc-800">“Our business development team prepares the firm’s submissions to Chambers UK and The Legal 500 each year.”</p>
              </div>
              <div className="flex items-center gap-3 px-3 py-3">
                <Marker n={3} />
                <p className="flex min-w-0 items-center gap-1 font-mono text-[11px] text-[#3448d6]"><span className="truncate">hartwellpryce.com/about/business-development</span><ArrowUpRight className="size-3 shrink-0" /></p>
              </div>
              <div className="space-y-2 border-t border-zinc-100 p-3">
                <div className="flex items-center gap-3">
                  <Marker n={4} />
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#3448d6]/10 text-[11px] font-semibold text-[#3448d6]">ES</span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-zinc-950">Eleanor Shaw</p>
                    <p className="truncate text-[11px] text-zinc-500">Head of Business Development · from the team page</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Marker n={5} />
                  <p className="min-w-0 flex-1 truncate font-mono text-[12px] text-zinc-800">e.shaw@hartwellpryce.com</p>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700"><Check className="size-3" strokeWidth={2.5} />Verified</span>
                </div>
              </div>
            </article>
          </div>
        </LatticePanel>
      </div>
    </Box>
  );
}

const steps: { n: string; title: string; body: string; tone: keyof typeof panelTones; tile: React.ReactNode }[] = [
  {
    n: "01", title: "Paste your website", tone: "blue",
    body: "That’s the whole setup. We read your site to learn what you sell and who it’s for.",
    tile: <Tile rows={[["/", "Read"], ["/pricing", "Read"], ["/customers", "Read"]]} mono />,
  },
  {
    n: "02", title: "Confirm your buyer", tone: "magenta",
    body: "We draft your ideal customer: who they are, how big, and who looks right but won’t buy. Change anything, then pick how many leads you want.",
    tile: <Tile rows={[["Industry", "Law firms"], ["Size", "20–500"], ["Not a fit", "Global firms"]]} />,
  },
  {
    n: "03", title: "We find and check", tone: "amber",
    body: "Our agent searches job posts, news, directories and team pages, then checks every company against your buyer. Weak fits are rejected, and you can see why.",
    tile: <Tile rows={[["Passed", "10"], ["Too big", "3"], ["No proof of fit", "2"]]} />,
  },
  {
    n: "04", title: "Start emailing", tone: "blue",
    body: "Get each company with the decision-maker, their email and LinkedIn, and drafts for day 1, 3 and 7. Export it all to CSV.",
    tile: <Tile rows={[["Day 1", "First email"], ["Day 3", "Follow-up"], ["Day 7", "New angle"]]} />,
  },
];

function Tile({ rows, mono }: { rows: string[][]; mono?: boolean }) {
  return (
    <div className="w-full max-w-[220px] overflow-hidden rounded-xl bg-white text-[12px] shadow-[0_18px_40px_-16px_rgba(9,9,11,0.5)]">
      {rows.map(([left, right]) => (
        <div key={left} className="flex items-center justify-between gap-3 border-t border-zinc-100 px-3 py-2 first:border-t-0">
          <span className={`truncate text-zinc-800 ${mono ? "font-mono text-[11px]" : ""}`}>{left}</span>
          <span className={`shrink-0 tabular-nums ${right === "Read" ? "text-emerald-700" : "text-zinc-500"}`}>{right}</span>
        </div>
      ))}
    </div>
  );
}

const stepBorders = ["", "border-t sm:border-t-0 sm:border-l", "border-t lg:border-t-0 lg:border-l", "border-t sm:border-l lg:border-t-0"];

function HowItWorks() {
  return (
    <Box id="how">
      <div className="flex flex-col justify-between gap-6 px-6 pt-16 pb-12 sm:px-11 sm:pt-20 md:flex-row md:items-end">
        <h2 className="max-w-xl text-[32px] leading-[1.15] font-medium tracking-[-0.03em] sm:text-[40px]">
          Your first leads in minutes. No setup.
        </h2>
        <p className="max-w-xs text-[15px] leading-6 text-zinc-700">No filters, no spreadsheets, no training. If you can paste a link, you can use Outmax.</p>
      </div>
      <ol className="grid border-t border-zinc-200 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.n} className={`relative flex flex-col border-zinc-200 ${stepBorders[index]}`}>
            <LatticePanel tone={step.tone} className="h-[200px] border-b border-zinc-200">
              <div className="flex h-full items-center justify-center px-6">{step.tile}</div>
            </LatticePanel>
            <div className="p-6">
              <p className="flex items-baseline gap-2.5 text-[17px] font-medium tracking-[-0.01em]">
                <span className="text-[#b3277d] tabular-nums">{step.n}</span>{step.title}
              </p>
              <p className="mt-2 text-[14px] leading-6 text-zinc-700">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Box>
  );
}

const signals = [
  { icon: Briefcase, kind: "Hiring", quote: "We’re hiring a Directories & Awards Manager to own our Legal 500 submissions.", source: "ostrandervale.co.uk/careers" },
  { icon: Award, kind: "Rankings", quote: "Ranked in 14 practice areas in The Legal 500 2026.", source: "maddoxkerr.com/recognition" },
  { icon: TrendingUp, kind: "Growth", quote: "Opening our Manchester office this spring with a team of 30.", source: "beaumontashby.com/news" },
  { icon: Newspaper, kind: "Funding", quote: "Kestrel Money closes a $6M seed round to build out its finance team.", source: "kestrelmoney.com/press" },
  { icon: Mic, kind: "Events", quote: "Our Head of BD is speaking on directory strategy at this year’s legal marketing summit.", source: "corwintate.com/events" },
  { icon: Users, kind: "Team changes", quote: "Our business development team has grown from three to nine people this year.", source: "lindeholm.se/team" },
];

function Signals() {
  return (
    <Box>
      <SectionHead title="Reach companies the moment they need you." accent="When a company hires, raises money, expands or wins an award, it’s ready to buy. We spot it for you." />
      <div className="relative mx-6 mb-16 grid border-t border-l border-zinc-200 bg-white sm:mx-11 sm:grid-cols-2 lg:grid-cols-3">
        <Plus className="-top-[5px] -left-[5px] z-10" />
        <Plus className="-right-[5px] -bottom-[5px] z-10" />
        {signals.map(({ icon: Icon, kind, quote, source }) => (
          <figure key={kind} className="flex flex-col border-r border-b border-zinc-200 p-6">
            <figcaption className="flex items-center gap-2 text-[13px] font-medium text-zinc-700">
              <Icon className="size-4 text-zinc-500" strokeWidth={1.75} />{kind}
            </figcaption>
            <blockquote className="mt-4 flex-1 text-[17px] leading-[1.45] tracking-[-0.01em] text-zinc-900">“{quote}”</blockquote>
            <p className="mt-6 flex items-center gap-1 truncate font-mono text-[11px] text-[#3448d6]">{source}<ArrowUpRight className="size-3 shrink-0" /></p>
          </figure>
        ))}
      </div>
    </Box>
  );
}

function ExampleSearch() {
  const stats = [
    ["10", "companies that passed every check"],
    ["5", "rejected, each with a reason"],
    ["9", "decision-makers found"],
    ["8", "work emails, 5 verified"],
    ["30", "email drafts ready to send"],
  ];
  return (
    <Box>
      <div className="flex flex-col justify-between gap-2 px-6 pt-14 pb-10 sm:flex-row sm:items-baseline sm:px-11">
        <h2 className="text-[24px] font-medium tracking-[-0.02em]">What one search gets you</h2>
        <p className="text-[13px] text-zinc-600">Example search for a legal-tech company</p>
      </div>
      <dl className="grid grid-cols-2 border-t border-zinc-200 sm:grid-cols-5">
        {stats.map(([value, label], index) => (
          <div key={label} className={`border-zinc-200 px-6 py-8 sm:px-8 ${index % 2 === 1 ? "border-l" : ""} ${index > 1 ? "border-t sm:border-t-0" : ""} sm:border-l sm:first:border-l-0 ${index === 4 ? "col-span-2 sm:col-span-1" : ""}`}>
            <dt className="sr-only">{label}</dt>
            <dd className="text-[40px] leading-none font-medium tracking-[-0.04em] tabular-nums">{value}</dd>
            <dd className="mt-3 text-[13px] leading-5 text-zinc-600">{label}</dd>
          </div>
        ))}
      </dl>
      <Hatch />
    </Box>
  );
}

function Pricing() {
  const plans = [
    {
      name: "Free", price: "$0", unit: "", blurb: "See the leads we find for you before you pay anything.", cta: "Get my free leads", href: "/onboarding", featured: false,
      items: ["1 search", "Up to 10 companies", "Decision-maker and email drafts for each", "No credit card needed"],
    },
    {
      name: "Pro", price: "$79", unit: "/month", blurb: "For founders and reps who want a full pipeline every month.", cta: "Start with Pro", href: "/onboarding", featured: true,
      items: ["15 searches a month", "Up to 50 companies per search", "Work emails, verified where possible", "Target any market or title", "CSV export"],
    },
    {
      name: "Team", price: "Custom", unit: "", blurb: "For sales teams and agencies running searches every week.", cta: "Talk to us", href: "mailto:hello@outmax.app", featured: false,
      items: ["Everything in Pro", "Seats for your whole team", "Higher monthly volume", "CRM sync when it launches", "Priority support"],
    },
  ];
  return (
    <Box id="pricing">
      <SectionHead title="One booked meeting pays for a year." accent="Start free. Upgrade when the replies start coming in." />
      <div className="grid border-t border-zinc-200 lg:grid-cols-3">
        {plans.map((plan, index) => (
          <div key={plan.name} className={`relative flex flex-col border-zinc-200 p-7 sm:p-9 ${index > 0 ? "border-t lg:border-t-0 lg:border-l" : ""} ${plan.featured ? "bg-white" : ""}`}>
            {plan.featured && <div aria-hidden className="absolute inset-x-0 -top-px h-0.5 bg-[#3448d6]" />}
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold tracking-[-0.01em]">{plan.name}</p>
              {plan.featured && <span className="rounded-md bg-[#3448d6]/10 px-2 py-0.5 text-[12px] font-semibold text-[#3448d6]">Most popular</span>}
            </div>
            <p className="mt-5 flex items-baseline gap-1">
              <span className="text-[44px] leading-none font-medium tracking-[-0.04em] tabular-nums">{plan.price}</span>
              <span className="text-[14px] text-zinc-600">{plan.unit}</span>
            </p>
            <p className="mt-3 text-[14px] leading-6 text-zinc-700 lg:min-h-12">{plan.blurb}</p>
            <Button href={plan.href} variant={plan.featured ? "primary" : "secondary"} className="mt-6 w-full">{plan.cta}</Button>
            <ul className="mt-7 space-y-3 border-t border-zinc-200 pt-6">
              {plan.items.map((item) => (
                <li key={item} className="flex gap-2.5 text-[14px] text-zinc-700"><Check className="mt-0.5 size-4 shrink-0 text-[#3448d6]" strokeWidth={2.25} />{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Box>
  );
}

const faqs = [
  ["How is this different from Apollo or ZoomInfo?", "They sell you everyone who matches a filter, whether they need you or not. We only give you companies with a visible reason to buy right now, and we show you that reason, so your first email lands."],
  ["How do you decide a company fits?", "Every company is checked against your ideal customer. Each must-have needs a quote from a real page, and companies that are too big, already solved the problem or sit on your not-a-fit list are rejected. You can see every rejected company and why."],
  ["Will this work for my business?", "If you sell to other businesses and have a website, yes. Your free search will show you in minutes, before you pay anything."],
  ["How accurate are the emails?", "Emails come from public pages or Fiber’s contact data, never guessed from a pattern. We mark an email verified only when it passes a deliverability check, and label the rest unverified."],
  ["Where do the leads come from?", "Public sources: company websites, job posts, news, directories and professional profiles. Every lead links to the page we found it on."],
  ["Do you send the emails for me?", "No. We write a three-email sequence for each lead, and you send it from your own inbox or the tool you already use."],
  ["Can I get leads into my CRM?", "Export any search to CSV and import it into your CRM. Direct CRM sync is coming."],
];

function Faq() {
  return (
    <Box id="faq">
      <div className="grid gap-10 px-6 py-16 sm:px-11 sm:py-20 lg:grid-cols-[2fr_3fr]">
        <div>
          <h2 className="text-[36px] leading-[1.1] font-medium tracking-[-0.03em] sm:text-[44px]">Before you start</h2>
          <p className="mt-4 text-[15px] text-zinc-700">Something else? <a href="mailto:hello@outmax.app" className="font-medium text-zinc-950 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-950">Email us</a>.</p>
        </div>
        <div className="border-t border-zinc-200">
          {faqs.map(([question, answer]) => (
            <details key={question} className="group border-b border-zinc-200">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[16px] font-medium tracking-[-0.01em] [&::-webkit-details-marker]:hidden">
                {question}
                <span aria-hidden className="relative size-3 shrink-0 text-zinc-500">
                  <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-current" />
                  <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-current transition-transform group-open:scale-y-0" />
                </span>
              </summary>
              <p className="max-w-xl pb-5 text-[15px] leading-6 text-zinc-700">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </Box>
  );
}

function Closing() {
  return (
    <Box>
      <LatticePanel tone="blue">
        <div className="px-6 py-24 text-center sm:py-28">
          <h2 className="mx-auto max-w-2xl text-[40px] leading-[1.08] font-medium tracking-[-0.04em] text-white sm:text-[60px]">
            Get your first 10 leads free
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-[18px] font-medium tracking-[-0.02em] text-white/90">Paste your website. In minutes you’ll know which companies need you this week, who to email and what to say.</p>
          <div className="mt-9"><SiteForm center onColor id="url-footer" /></div>
        </div>
      </LatticePanel>
    </Box>
  );
}

function Footer() {
  const columns: [string, [string, string][]][] = [
    ["Product", [["How it works", "#how"], ["Pricing", "#pricing"], ["Start a search", "/onboarding"], ["Chat", "/simple"]]],
    ["Use cases", [["Founders", "#use-cases"], ["Sales teams", "#use-cases"], ["Agencies", "#use-cases"]]],
    ["Company", [["Contact", "mailto:hello@outmax.app"], ["FAQ", "#faq"]]],
  ];
  return (
    <footer className="border-t border-zinc-200 bg-white">
      <div className="mx-auto grid max-w-[1080px] gap-10 px-6 py-14 sm:px-11 md:grid-cols-[2fr_repeat(3,1fr)]">
        <div className="self-start">
          <Wordmark className="text-zinc-950" />
          <p className="mt-4 max-w-xs text-[13px] leading-5 text-zinc-600">Find companies ready to buy from you this week.</p>
        </div>
        {columns.map(([heading, links]) => (
          <div key={heading}>
            <p className="text-[14px] font-medium text-zinc-950">{heading}</p>
            <ul className="mt-4 space-y-2.5">
              {links.map(([label, href]) => (
                <li key={label}>
                  {href.startsWith("/")
                    ? <Link href={href} className="text-[14px] text-zinc-600 transition-colors hover:text-zinc-950">{label}</Link>
                    : <a href={href} className="text-[14px] text-zinc-600 transition-colors hover:text-zinc-950">{label}</a>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-[1080px] flex-col gap-2 border-t border-zinc-200 px-6 py-6 text-[13px] text-zinc-600 sm:flex-row sm:justify-between sm:px-11">
        <span>© 2026 Outmax</span>
        <span>Companies, people and numbers shown on this page are illustrative.</span>
      </div>
    </footer>
  );
}
