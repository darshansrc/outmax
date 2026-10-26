import { z } from "zod";
import { leadSchema, TARGET_COUNT } from "./leads";

const text = z.string().trim().min(1);
const list = z.array(text);

export const DRAFT_DAYS = [1, 3, 7] as const;

export const businessSchema = z.object({
  name: text,
  oneLiner: text.describe("What the company sells and to whom, in one plain sentence."),
  offerings: list.describe("Products or services named on the site."),
  pricing: text.nullable().describe("Public pricing model or price points, or null when not shown."),
  customersMentioned: list.describe("Customer names, logos or case-study companies named on the site."),
  competitors: list.describe("Competitors named on the site. Leave empty when none are named."),
});

export const profileSchema = z.object({
  industries: list,
  companySizeMin: z.number().int().positive().nullable().describe("Minimum employees, or null when unknown."),
  companySizeMax: z.number().int().positive().nullable().describe("Maximum employees, or null when unbounded or unknown."),
  regions: list,
  buyerTitles: list.describe("Job titles of the person who signs off on buying this product."),
  buyingSignals: list.describe("Public events that show a company needs this product now, such as a hiring post, funding, expansion or a launch."),
  mustHaves: list.describe("Hard requirements a company must meet to qualify."),
  exclusions: list.describe("Companies or kinds of companies to skip, including the product company itself."),
});

export const analysisSchema = z.object({ business: businessSchema, profile: profileSchema });

export const startRunSchema = z.object({
  website: z.httpUrl(),
  business: businessSchema,
  profile: profileSchema,
  senderName: z.string().trim().max(80).nullable(),
});

export const draftEmailSchema = z.object({
  day: z.union([z.literal(1), z.literal(3), z.literal(7)]),
  subject: text,
  body: text,
});

export const draftsOutputSchema = z.object({
  sequences: z.array(z.object({
    leadIndex: z.number().int().min(0),
    emails: z.array(draftEmailSchema).length(DRAFT_DAYS.length),
  })),
});

export type Business = z.infer<typeof businessSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type StartRun = z.infer<typeof startRunSchema>;
export type DraftEmail = z.infer<typeof draftEmailSchema>;
export type Lead = z.infer<typeof leadSchema>;

export type DraftState =
  | { status: "pending"; startedAt: number }
  | { status: "ready"; sequences: Record<number, DraftEmail[]> }
  | { status: "failed"; error: string };

export type OnboardingRun = {
  runId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | string;
  createdAt: string | null;
  completedAt: string | null;
  website: string;
  business: Business;
  profile: Profile;
  senderName: string | null;
  leads: Lead[];
  shortfallReason: string | null;
  drafts: DraftState | null;
  error?: string;
};

export function normalizeWebsite(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (parsed.username || parsed.password || !parsed.hostname.includes(".")) return null;
    parsed.hash = "";
    parsed.search = "";
    return parsed.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function siteLabel(website: string) {
  return new URL(website).hostname.replace(/^www\./, "");
}

export function sizeLabel(profile: Pick<Profile, "companySizeMin" | "companySizeMax">) {
  const { companySizeMin: min, companySizeMax: max } = profile;
  if (min && max) return `${min}–${max} employees`;
  if (min) return `${min}+ employees`;
  if (max) return `Up to ${max} employees`;
  return null;
}

export function searchQuery({ website, business, profile }: StartRun) {
  const size = sizeLabel(profile);
  return [
    `Find ${TARGET_COUNT} distinct companies that are likely to buy from ${business.name} (${website}) now.`,
    `What they sell: ${business.oneLiner}`,
    profile.industries.length ? `Industries: ${profile.industries.join("; ")}.` : null,
    size ? `Company size: ${size}.` : null,
    profile.regions.length ? `Regions: ${profile.regions.join("; ")}.` : null,
    profile.mustHaves.length ? `Every company must meet all of these: ${profile.mustHaves.join("; ")}.` : null,
    profile.buyingSignals.length
      ? `Prefer companies showing at least one of these signals, and cite the page that shows it: ${profile.buyingSignals.join("; ")}.`
      : null,
    `Exclude ${business.name} itself${profile.exclusions.length ? ` and: ${profile.exclusions.join("; ")}` : ""}.`,
    business.competitors.length ? `Exclude these competitors: ${business.competitors.join("; ")}.` : null,
    business.customersMentioned.length
      ? `These are existing customers. Exclude them, and use them as examples of a good fit: ${business.customersMentioned.join("; ")}.`
      : null,
    `For each company, find the most relevant current decision-maker${profile.buyerTitles.length ? ` with a title like: ${profile.buyerTitles.join("; ")}` : ""}.`,
    "The user confirmed this profile. Treat it as mandatory.",
    "Use Fiber to find companies and relevant current decision-makers.",
    "In fitExplanation, state the specific reason this company fits and any buying signal, in one or two plain sentences.",
    "Provide sourceUrls for company identity and qualification, and contactSourceUrls for returned contact details.",
    "Return only contacts and work emails actually retrieved from Fiber or cited sources; never guess names, email patterns, titles, or LinkedIn URLs.",
    "contactDataSource must identify the actual provider/document used, not merely an enabled provider.",
    "Set emailVerificationStatus to verified only when an actual verifier result supports that exact email.",
    "Provide emailVerificationEvidence with the exact email, verifier source, result and supporting source URL. Finding an email or LinkedIn profile is not verification.",
    "Use null for unavailable details. Keep qualified companies even if no supported contact is available.",
    "Return fewer companies when evidence or budget is insufficient; explain the shortfall in shortfallReason.",
  ].filter(Boolean).join("\n");
}
