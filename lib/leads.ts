import { z } from "zod";

export const MODEL = "openai/gpt-6.1-sol";
export const TARGET_COUNT = 20;
const text = z.string().trim().min(1);
const url = z.httpUrl();

export const requestSchema = z.object({
  prompt: text.max(8_000),
  waitForResults: z.boolean().default(true),
});

export const icpSchema = z.object({
  productSummary: text,
  industries: z.array(text),
  companySize: text.nullable(),
  geography: z.array(text),
  buyerRoles: z.array(text),
  qualificationCriteria: z.array(text),
  explicitUserInstructions: z.array(text).describe(
    "Constraints stated by the user, which override every inferred preference.",
  ),
});

export const leadSchema = z.object({
  companyName: text.nullable(),
  website: url.nullable(),
  location: text.nullable(),
  fitExplanation: text.nullable(),
  sourceUrls: z.array(url).min(1).nullable().describe(
    "Actual sources supporting the company's identity and qualification.",
  ),
  contactName: text.nullable(),
  jobTitle: text.nullable(),
  workEmail: z.email().nullable(),
  linkedInUrl: url.nullable(),
  contactDataSource: text.nullable().describe(
    "Actual provider or document used; enabling Fiber alone is not evidence of use.",
  ),
  contactSourceUrls: z.array(url).min(1).nullable().describe(
    "Sources supporting this person's current employment and returned contact details.",
  ),
  emailVerificationStatus: z.enum([
    "verified", "unverified", "invalid", "catch_all",
  ]).nullable(),
  emailVerificationEvidence: z.object({
    email: z.email(),
    source: text,
    result: z.enum(["verified", "deliverable"]),
    sourceUrl: url.describe(
      "Source documenting the actual verification result for this exact email; a profile URL alone is insufficient.",
    ),
  }).nullable(),
});

export const resultSchema = z.object({
  leads: z.array(leadSchema).max(TARGET_COUNT),
  shortfallReason: text.nullable(),
});

// Send plain JSON Schema: exa-js's Zod overload uses its own Zod 3 dependency.
export const agentOutputSchema = z.toJSONSchema(resultSchema, {
  target: "draft-07",
});

export type ICP = z.infer<typeof icpSchema>;
export type Lead = z.infer<typeof leadSchema>;

export function extractWebsite(prompt: string): string | null {
  const candidates = [...new Set(
    (prompt.match(/https?:\/\/[^\s<>"`]+/gi) ?? [])
      .map((value) => value.replace(/[.,;!?)\]}]+$/, "")),
  )];
  if (candidates.length !== 1) return null;
  const parsed = url.safeParse(candidates[0]);
  if (!parsed.success) return null;
  const website = new URL(parsed.data);
  if (website.username || website.password) return null;
  website.hash = "";
  return website.href;
}

export function cleanLeads(input: Lead[]) {
  const names = new Set<string>();
  const domains = new Set<string>();
  let duplicatesRemoved = 0;
  let unsupportedRemoved = 0;
  let contactsCleared = 0;
  let verificationClaimsCleared = 0;
  const leads: Lead[] = [];

  for (const item of input) {
    if (!item.companyName || !item.fitExplanation || !item.sourceUrls?.length) {
      unsupportedRemoved++;
      continue;
    }
    const name = item.companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const domain = item.website
      ? new URL(item.website).hostname.toLowerCase().replace(/^www\./, "")
      : null;
    if (names.has(name) || (domain && domains.has(domain))) {
      duplicatesRemoved++;
      continue;
    }
    names.add(name);
    if (domain) domains.add(domain);

    const lead = { ...item };
    if (!lead.contactName || !lead.contactDataSource || !lead.contactSourceUrls?.length) {
      if (lead.contactName || lead.jobTitle || lead.workEmail || lead.linkedInUrl) {
        contactsCleared++;
      }
      lead.contactName = lead.jobTitle = lead.workEmail = lead.linkedInUrl = null;
      lead.contactDataSource = lead.contactSourceUrls = null;
      lead.emailVerificationStatus = lead.emailVerificationEvidence = null;
    }
    const proof = lead.emailVerificationEvidence;
    if (!lead.workEmail || !proof ||
        proof.email.toLowerCase() !== lead.workEmail.toLowerCase()) {
      lead.emailVerificationEvidence = null;
      if (lead.emailVerificationStatus === "verified") {
        verificationClaimsCleared++;
        lead.emailVerificationStatus = null;
      }
    }
    if (!lead.workEmail) lead.emailVerificationStatus = null;
    leads.push(lead);
  }
  return {
    leads, duplicatesRemoved, unsupportedRemoved,
    contactsCleared, verificationClaimsCleared,
  };
}
