import Exa, { type AgentRun } from "exa-js";
import { z } from "zod";
import { isActive } from "../lead-runs";

const FIBER_BASE_URL = "https://api.fiber.ai";

export type FiberEmail = { email: string; status: "valid" | "risky" | "unknown" | "invalid" | null };
export type FiberResult = { emails: FiberEmail[]; credits: number };

const charge = z.object({ creditsCharged: z.number() }).partial().nullish();

const revealSchema = z.object({
  output: z.object({
    profile: z.object({
      emails: z.array(z.object({ email: z.string(), type: z.string().nullish(), status: z.string().nullish() })).default([]),
    }).nullish(),
  }).nullish(),
  chargeInfo: charge,
});

const basicSchema = z.object({
  output: z.object({
    emails: z.array(z.object({ emailAddress: z.string().nullish(), type: z.string().nullish(), validationStatus: z.string().nullish() })).default([]),
  }).nullish(),
  chargeInfo: charge,
});

const statuses = new Set(["valid", "risky", "unknown", "invalid"]);
const toStatus = (value: string | null | undefined) => (value && statuses.has(value) ? value : null) as FiberEmail["status"];

async function fiber(path: string, body: Record<string, unknown>, signal: AbortSignal) {
  const apiKey = process.env.FIBER_API_KEY?.trim();
  if (!apiKey) throw new Error("FIBER_API_KEY is not configured.");
  const response = await fetch(`${FIBER_BASE_URL}${path}`, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(`Fiber returned HTTP ${response.status}.`);
  return response.json();
}

export function fiberConfigured() {
  return Boolean(process.env.FIBER_API_KEY?.trim());
}

/** Work emails for a known LinkedIn profile, matched to the company domain. */
export async function revealFromLinkedIn(linkedinUrl: string, domain: string, signal: AbortSignal): Promise<FiberResult> {
  const parsed = revealSchema.parse(await fiber("/v1/contact-details/single", {
    linkedinUrl,
    enrichmentType: { getWorkEmails: true, getPersonalEmails: false, getPhoneNumbers: false },
    patience: "MEDIUM",
    company: { identifier: "domain", value: domain },
  }, signal));
  const emails = (parsed.output?.profile?.emails ?? [])
    .filter((item) => !item.type || item.type === "work")
    .map((item) => ({ email: item.email.toLowerCase(), status: toStatus(item.status) }));
  return { emails, credits: parsed.chargeInfo?.creditsCharged ?? 0 };
}

/** At most one work email from a full name and company domain. */
export async function emailFromName(fullName: string, domain: string, signal: AbortSignal): Promise<FiberResult> {
  const parsed = basicSchema.parse(await fiber("/v1/contact-details/basic-work-email", {
    name: { mode: "fullName", fullName },
    company: { mode: "domain", domain },
  }, signal));
  const emails = (parsed.output?.emails ?? [])
    .filter((item) => item.emailAddress && item.type !== "personal")
    .map((item) => ({ email: item.emailAddress!.toLowerCase(), status: toStatus(item.validationStatus) }));
  return { emails, credits: parsed.chargeInfo?.creditsCharged ?? 0 };
}

/* Exa agent with Fiber: last resort when the web found no person at all. */

const nullable = z.string().trim().min(1).nullable();

const agentContactSchema = z.object({
  contactName: nullable,
  jobTitle: nullable,
  workEmail: nullable.describe("Work email returned by Fiber, or null."),
  linkedInUrl: nullable.describe("linkedin.com/in/ profile url, or null."),
});

// Send plain JSON Schema: exa-js's Zod overload uses its own Zod 3 dependency.
const agentOutputSchema = z.toJSONSchema(agentContactSchema, { target: "draft-07" });

export type AgentContact = z.infer<typeof agentContactSchema>;

const exa = () => new Exa(process.env.EXA_API_KEY);

export async function startAgentLookup(lookup: { domain: string; companyName: string; titles: string[] }, metadata: Record<string, string>) {
  return exa().agent.runs.create({
    effort: "minimal",
    dataSources: [{ provider: "fiber" }],
    metadata,
    outputSchema: agentOutputSchema,
    query: [
      `Use Fiber to find the work email and LinkedIn profile of the most senior person with one of these titles: ${lookup.titles.join("; ") || "founder, CEO"} at ${lookup.companyName} (${lookup.domain}).`,
      "Return only what Fiber returns for a person currently at this company. Use null for anything not found. Do not guess emails.",
    ].join("\n"),
  });
}

export async function readAgentLookup(id: string): Promise<{ done: boolean; run: AgentRun; contact: AgentContact | null }> {
  const run = await exa().agent.runs.get(id);
  if (isActive(run)) return { done: false, run, contact: null };
  const parsed = agentContactSchema.safeParse(run.output?.structured);
  return { done: true, run, contact: run.status === "completed" && parsed.success ? parsed.data : null };
}

export function costOf(run: AgentRun) {
  return typeof run.costDollars?.total === "number" ? run.costDollars.total : 0;
}
