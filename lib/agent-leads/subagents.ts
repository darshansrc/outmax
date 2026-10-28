import { z } from "zod";
import { sizeLabel, type Business, type Profile } from "../onboarding";
import type { SearchRow } from "../web-search";
import { domainOf, emptyUsage, excerpts, extract, grounded, normalizeUrl, research, textSeen, type SearchUsage } from "./search";

const text = z.string().trim().min(1);
const nullableText = z.string().trim().min(1).nullable();
// OpenAI structured output rejects JSON Schema format "uri", so URLs are plain strings checked in code.
const urlText = z.string().trim().min(1).describe("An absolute https URL copied from the excerpts.");

export const PASS_SCORE = 60;

export type Brief = { website: string; business: Business; profile: Profile };

export function buyerBrief({ website, business, profile }: Brief) {
  return {
    seller: { name: business.name, website, sells: business.oneLiner, offerings: business.offerings.slice(0, 8), pricing: business.pricing },
    idealCustomer: {
      description: profile.idealCustomer || null,
      industries: profile.industries,
      size: sizeLabel(profile),
      regions: profile.regions,
      mustHaves: profile.mustHaves,
      buyingSignals: profile.buyingSignals,
      notAFit: profile.notAFit ?? [],
      leaveOut: [...profile.exclusions, ...business.competitors],
      existingCustomersAsExamples: business.customersMentioned.slice(0, 10),
      decisionMakerTitles: profile.buyerTitles,
    },
  };
}

export function requiredCriteria(profile: Profile) {
  return [
    ...(profile.industries.length ? [`Operates in one of these industries: ${profile.industries.join("; ")}`] : []),
    ...profile.mustHaves,
  ];
}

function httpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? normalizeUrl(url.href) : null;
  } catch {
    return null;
  }
}

/* Planner: search angles, no tools. */

const planSchema = z.object({
  angles: z.array(z.object({
    label: text.max(80).describe("A short name for this angle, like 'Hiring a Head of Finance'."),
    query: text.max(400).describe("What the scout should search for, in plain words. One distinct way to find buyers."),
  })).min(3).max(10),
});

export async function planAngles(brief: Brief, { used, rejectionSummary, signal }: { used: string[]; rejectionSummary: string | null; signal?: AbortSignal }) {
  const usage = emptyUsage();
  const plan = await extract({
    schema: planSchema,
    usage,
    signal,
    maxOutputTokens: 2_000,
    instructions: [
      "You plan web searches that find companies likely to buy from the seller.",
      "First think about who realistically buys: their stage, size and situation from the ideal customer description, the seller's pricing and the existing customers. Then think about where companies like that are visible on the web.",
      "Small and early companies show up in launch sites, startup and indie directories, marketplaces and app stores, niche community lists, small-company job posts and 'alternative to' discussions. Large companies show up in rankings and enterprise news. Search where the ideal customer is, not where the biggest names are.",
      "Write distinct angles, for example: companies showing a buying signal, recent launches, directories of the right kind of company, job posts for the decision-maker's team, companies similar to existing customers, people looking for alternatives to competitors.",
      "Each angle must find buying companies of the right size, not vendors, agencies, publishers, the seller's competitors or famous market leaders that have outgrown the product.",
      "Do not repeat any angle in usedAngles. If a rejection summary is given, steer away from what got rejected.",
    ],
    input: { ...buyerBrief(brief), usedAngles: used, rejectionSummary },
  });
  return { angles: plan.angles, usage };
}

/* Scout: one angle in, a short list of candidate companies out. */

const scoutSchema = z.object({
  candidates: z.array(z.object({
    companyName: text,
    website: urlText.describe("The company's own website homepage, not a directory, news or LinkedIn page."),
    reason: text.max(300).describe("Why this company may fit, from the excerpts."),
    sourceUrl: urlText,
  })).max(12),
});

export type Candidate = { companyName: string; website: string; domain: string; reason: string; sourceUrl: string };

export async function scout(brief: Brief, angle: { label: string; query: string }, skip: string[], signal?: AbortSignal) {
  const found = await research({
    label: `scout "${angle.label}"`,
    signal,
    maxSteps: 4,
    numResults: 10,
    excludeDomains: skipDomains(brief, skip),
    instructions: [
      "You find companies that are likely to buy from the seller. You are working one search angle only.",
      "Find real operating companies that match the ideal customer description, including its stage and size. Prefer each company's own website as the source of truth.",
      "Skip household names and companies far larger or more established than the ideal customer, unless the description asks for them. Skip anything in notAFit.",
      "Skip the seller, its competitors, vendors that sell similar products, agencies, publishers, directories and anything in the skip list.",
      `For launches, funding, hiring or other recent signals, set start_published_date to ${yearAgo()}.`,
      "List up to 12 candidates with their official website and the exact sentence that suggests they fit.",
    ],
    prompt: { ...buyerBrief(brief), angle, skip: skip.slice(0, 200) },
  });
  const output = await extract({
    schema: scoutSchema,
    usage: found.usage,
    signal,
    instructions: [
      "Turn the research brief into a candidate list. Only include companies that appear in the excerpts.",
      "website must be the company's own homepage. Never use a directory, review site, news article, job board or LinkedIn URL as the website.",
    ],
    input: { angle, brief: found.brief, sources: excerpts(found.sources, 40_000) },
  });
  const candidates: Candidate[] = [];
  for (const item of output.candidates) {
    const website = httpUrl(item.website);
    const domain = domainOf(website);
    const sourceUrl = httpUrl(item.sourceUrl);
    if (!website || !domain || !sourceUrl) continue;
    if (/(^|\.)(linkedin|crunchbase|g2|capterra|clutch|glassdoor|indeed|wikipedia|facebook|x|twitter|medium|github|youtube)\.com$/.test(domain)) continue;
    candidates.push({ companyName: item.companyName, website, domain, reason: item.reason, sourceUrl });
  }
  return { candidates, usage: found.usage };
}

/* Verifier: the pass layer. */

const verdictSchema = z.object({
  isOperatingCompany: z.boolean().describe("A real company that could buy, not a directory, vendor of a similar product, agency or publisher."),
  companyName: text,
  location: nullableText.describe("Headquarters city and country, when shown."),
  employeeCount: z.number().int().positive().nullable().describe("Best estimate of employees from the excerpts, such as a LinkedIn size band midpoint or a team page count. Null when there is no evidence."),
  realisticBuyer: z.object({
    met: z.enum(["yes", "no", "unknown"]),
    reason: text.max(300),
  }).describe("Would this company realistically adopt the seller's product now, given the ideal customer description, size, pricing and notAFit? No when it is too large or established, has clearly built its own solution, or is the wrong kind of business."),
  checks: z.array(z.object({
    criterion: text.describe("The exact required criterion text."),
    met: z.enum(["yes", "no", "unknown"]),
    quote: nullableText.describe("Exact sentence from an excerpt that proves it."),
    sourceUrl: nullableText,
  })),
  signal: z.object({
    description: text.max(200),
    quote: text,
    sourceUrl: text,
  }).nullable().describe("A buying signal from the ideal customer's list, when one is found."),
  fitExplanation: text.max(400).describe("One or two plain sentences: why this company fits and any buying signal."),
  score: z.number().int().min(0).max(100).describe("How strong a prospect this is. 60 or more means worth contacting."),
  verdict: z.enum(["pass", "reject"]),
  rejectReason: nullableText.describe("Short reason when rejected."),
});

export type Verdict =
  | { pass: true; companyName: string; location: string | null; fitExplanation: string; score: number; sourceUrls: string[] }
  | { pass: false; companyName: string; reason: string };

export async function verify(brief: Brief, candidate: Candidate, signal?: AbortSignal, pages?: SearchRow[]): Promise<{ verdict: Verdict; usage: SearchUsage }> {
  const criteria = requiredCriteria(brief.profile);
  const found = await research({
    label: `verify ${candidate.domain}`,
    signal,
    maxSteps: 4,
    numResults: 6,
    domain: candidate.domain,
    pages,
    instructions: [
      "You verify one prospective customer for the seller. Be skeptical.",
      "companyPages, when given, are the company's own homepage and subpages. Start from them, and use site_search only for facts they don't cover.",
      "Use company_search for its LinkedIn company page and headcount, and web_search for news or job posts that show buying signals.",
      `For recent news or job posts, set start_published_date to ${yearAgo()}.`,
      "Check every required criterion. Judge whether it matches the ideal customer description in stage and size, and whether it would realistically adopt the seller's product now. Note anything in notAFit or leave-out that applies.",
    ],
    prompt: { ...buyerBrief(brief), requiredCriteria: criteria, candidate },
  });
  const output = await extract({
    schema: verdictSchema,
    usage: found.usage,
    signal,
    instructions: [
      "Decide whether this company is a good prospect for the seller.",
      "Return one check per required criterion, in order, with its exact text. met is yes only when an excerpt clearly proves it; give that exact quote and its url.",
      "Reject when the company is in notAFit or the leave-out list, is a competitor or similar vendor, is not an operating company, clearly fails a criterion, or would not realistically adopt the product now.",
      "A company much larger or more established than the ideal customer is a reject, even if it is in the right industry. A well-known market leader is rarely a fit for a product aimed at small or early companies.",
      "Region outside the ideal customer lowers the score. A buying signal raises it, but it is optional.",
      `Score 0 to 100. Pass needs a score of ${PASS_SCORE} or more and every criterion proven.`,
    ],
    input: { ...buyerBrief(brief), requiredCriteria: criteria, candidate, brief: found.brief, sources: excerpts(found.sources) },
  });

  const reject = (reason: string): { verdict: Verdict; usage: SearchUsage } => ({ verdict: { pass: false, companyName: output.companyName || candidate.companyName, reason }, usage: found.usage });
  if (!output.isOperatingCompany) return reject(output.rejectReason ?? "Not an operating company that could buy.");
  if (output.realisticBuyer.met === "no") return reject(output.realisticBuyer.reason);
  const { companySizeMin: min, companySizeMax: max } = brief.profile;
  const people = output.employeeCount;
  if (people && max && people > max * 2) return reject(`Too big for the ideal customer (about ${people.toLocaleString("en-US")} employees).`);
  if (people && min && people < min / 2) return reject(`Too small for the ideal customer (about ${people.toLocaleString("en-US")} employees).`);
  if (output.verdict === "reject") return reject(output.rejectReason ?? "Didn’t match the ideal customer.");
  if (output.score < PASS_SCORE) return reject(output.rejectReason ?? `Weak fit (score ${output.score}).`);

  const sourceUrls = new Set<string>();
  for (const criterion of criteria) {
    const check = output.checks.find((item) => item.criterion.trim().toLowerCase() === criterion.trim().toLowerCase())
      ?? output.checks[criteria.indexOf(criterion)];
    const url = httpUrl(check?.sourceUrl);
    if (!check || check.met !== "yes" || !grounded(check.quote, url, found.sources)) {
      return reject(`Couldn’t prove: ${criterion}`);
    }
    if (url) sourceUrls.add(url);
  }
  const signalUrl = output.signal && grounded(output.signal.quote, output.signal.sourceUrl, found.sources) ? httpUrl(output.signal.sourceUrl) : null;
  if (signalUrl) sourceUrls.add(signalUrl);
  if (!sourceUrls.size) sourceUrls.add(candidate.website);

  return {
    verdict: {
      pass: true,
      companyName: output.companyName || candidate.companyName,
      location: output.location,
      fitExplanation: output.fitExplanation,
      score: output.score,
      sourceUrls: [...sourceUrls].slice(0, 4),
    },
    usage: found.usage,
  };
}

/* Contact finder: web first. */

const contactSchema = z.object({
  contactName: nullableText,
  jobTitle: nullableText,
  nameSourceUrl: nullableText.describe("Excerpt url that names this person at this company."),
  linkedInUrl: nullableText.describe("A linkedin.com/in/ profile url that appears in the excerpts."),
  workEmail: nullableText.describe("Only an email that appears verbatim in an excerpt."),
  emailSourceUrl: nullableText,
});

export type WebContact = {
  contactName: string | null;
  jobTitle: string | null;
  linkedInUrl: string | null;
  workEmail: string | null;
  sourceUrls: string[];
};

export async function findContact(brief: Brief, company: { companyName: string; website: string; domain: string }, signal?: AbortSignal, pages?: SearchRow[]) {
  const titles = brief.profile.buyerTitles;
  const found = await research({
    label: `contact ${company.domain}`,
    signal,
    maxSteps: 5,
    numResults: 6,
    domain: company.domain,
    pages,
    instructions: [
      "You find the one current person at a company who would sign off on buying the seller's product.",
      `Preferred titles: ${titles.join("; ") || "founder, CEO or head of the relevant team"}. At a small company the founder is fine.`,
      "companyPages, when given, may already include the team or about page. Use site_search for leadership pages they don't cover, people_search for LinkedIn profiles of people at the company, and web_search for press.",
      "Also look for that person's work email published anywhere on the web. Do not guess email patterns.",
    ],
    prompt: { company, sellerSells: brief.business.oneLiner, titles },
  });
  const output = await extract({
    schema: contactSchema,
    usage: found.usage,
    signal,
    maxOutputTokens: 1_000,
    instructions: [
      "Return the single best current decision-maker found in the excerpts, or nulls.",
      "Only return a person the excerpts show working at this company now. Only return an email or LinkedIn url that appears verbatim in the excerpts.",
    ],
    input: { company, titles, brief: found.brief, sources: excerpts(found.sources, 40_000) },
  });

  const contact: WebContact = { contactName: null, jobTitle: null, linkedInUrl: null, workEmail: null, sourceUrls: [] };
  if (output.contactName && textSeen(output.contactName, found.sources)) {
    contact.contactName = output.contactName;
    contact.jobTitle = output.jobTitle;
    const url = httpUrl(output.nameSourceUrl);
    if (url) contact.sourceUrls.push(url);
  }
  const linkedIn = httpUrl(output.linkedInUrl);
  if (contact.contactName && linkedIn && /linkedin\.com\/in\//i.test(linkedIn)
      && (found.sources.has(linkedIn) || textSeen(linkedIn.replace(/^https?:\/\/(www\.)?/, ""), found.sources))) {
    contact.linkedInUrl = linkedIn;
  }
  const email = output.workEmail?.toLowerCase().trim() ?? null;
  if (contact.contactName && email && z.email().safeParse(email).success && textSeen(email, found.sources)) {
    contact.workEmail = email;
    const url = httpUrl(output.emailSourceUrl);
    if (url && !contact.sourceUrls.includes(url)) contact.sourceUrls.push(url);
  }
  return { contact, usage: found.usage };
}

const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** The seller and skipped companies as Exa domain filters. Names that aren't domains stay in the prompt. */
function skipDomains(brief: Brief, skip: string[]) {
  const seller = domainOf(brief.website);
  const skipped = [...new Set(skip.map((item) => item.trim().toLowerCase()).filter((item) => DOMAIN.test(item) && item !== seller))];
  return [...(seller ? [seller] : []), ...skipped.slice(-99)];
}

const yearAgo = () => new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
