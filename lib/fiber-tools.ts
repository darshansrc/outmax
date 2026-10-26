import { tool } from "ai";
import { z } from "zod";

const FIBER_BASE_URL = "https://api.fiber.ai";
const domainSchema = z.string().trim().max(253)
  .regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i)
  .describe("Company website domain, such as acme.com, without a protocol or path.");
const emailSchema = z.email().max(320);
const responseSchema = z.object({
  output: z.unknown(),
  chargeInfo: z.unknown().optional(),
}).passthrough();

async function fiberRequest(
  path: string,
  body: Record<string, unknown> | undefined,
  abortSignal: AbortSignal | undefined,
  timeoutMs = 60_000,
) {
  const apiKey = process.env.FIBER_API_KEY?.trim();
  if (!apiKey) throw new Error("FIBER_API_KEY is not configured.");
  const signal = AbortSignal.any([
    AbortSignal.timeout(timeoutMs),
    ...(abortSignal ? [abortSignal] : []),
  ]);

  let response: Response;
  try {
    response = await fetch(`${FIBER_BASE_URL}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal,
    });
  } catch {
    throw new Error(signal.aborted
      ? "The Fiber request was stopped or timed out."
      : "Unable to connect to Fiber. Please try again.");
  }

  if (!response.ok) {
    const reason = response.status === 401 || response.status === 403 ? "Check FIBER_API_KEY and its access permissions."
      : response.status === 402 ? "The Fiber account has insufficient credits."
      : response.status === 429 ? "Fiber's rate limit was reached. Try again later."
      : response.status === 400 || response.status === 422 ? "Fiber rejected the lookup parameters."
      : "Fiber could not complete the lookup. Try again later.";
    throw new Error(`Fiber returned HTTP ${response.status}. ${reason}`);
  }

  const parsed = responseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success || !Object.hasOwn(parsed.data, "output")) {
    throw new Error("Fiber returned an invalid response.");
  }

  // Tool outputs are displayed and persisted. Never include the authentication key.
  const data: Record<string, unknown> = JSON.parse(JSON.stringify(parsed.data, (key, value) =>
    /^(apiKey|api_key|authorization|x-api-key)$/i.test(key) ? undefined
      : typeof value === "string" ? value.replaceAll(apiKey, "[redacted]") : value));
  return { provider: "fiber.ai", ...data };
}

export function createFiberTools() {
  return {
    fiber_search_leads: tool({
      description: "Search Fiber for companies or professional leads using natural language. Describe the target roles, company, industry, geography, and other criteria explicitly. Returns companies or people, supporting profile information, nextPageToken, and actual chargeInfo. Search is discovery, not email verification. Use a returned pageToken only when more results are needed.",
      inputSchema: z.object({
        query: z.string().trim().min(1).max(5_000),
        pageSize: z.number().int().min(1).max(25).default(10),
        pageToken: z.string().min(1).max(16_000).optional(),
      }),
      execute: (input, { abortSignal }) =>
        fiberRequest("/v1/nlp-search/run", input, abortSignal),
    }),
    fiber_reveal_contact: tool({
      description: "Find work emails for a known LinkedIn profile through Fiber's standard contact reveal. Use an actual profile URL or identifier returned by search; never invent one. Personal emails and phone numbers are not requested. Supply the current company domain when known. Emails in unmatchedWorkEmails do not match the requested/current company. Only email status 'valid' means deliverability verification passed; risky, unknown, invalid, or missing status must not be described as verified.",
      inputSchema: z.object({
        linkedinUrl: z.string().trim().min(1).max(1_000)
          .describe("A known LinkedIn profile URL, profile slug, Sales Navigator URN, or numeric LinkedIn user ID."),
        companyDomain: domainSchema.optional(),
      }),
      execute: ({ linkedinUrl, companyDomain }, { abortSignal }) =>
        fiberRequest("/v1/contact-details/single", {
          linkedinUrl,
          enrichmentType: { getWorkEmails: true, getPersonalEmails: false, getPhoneNumbers: false },
          patience: "MEDIUM",
          ...(companyDomain ? { company: { identifier: "domain", value: companyDomain } } : {}),
        }, abortSignal, 120_000),
    }),
    fiber_find_work_email: tool({
      description: "Find a work email from a person's actual full name and company domain when no LinkedIn profile is available. Returns at most one email, or an empty array if none is found. Do not guess email patterns or claim that discovery proves deliverability; use fiber_validate_email when validation is needed.",
      inputSchema: z.object({
        fullName: z.string().trim().min(1).max(200),
        companyDomain: domainSchema,
      }),
      execute: ({ fullName, companyDomain }, { abortSignal }) =>
        fiberRequest("/v1/contact-details/basic-work-email", {
          name: { mode: "fullName", fullName },
          company: { mode: "domain", domain: companyDomain },
        }, abortSignal, 240_000),
    }),
    fiber_validate_email: tool({
      description: "Validate an exact email address through Fiber's bounce-detection API. Returns verdict (ok, undeliverable, risky, or inconclusive), deliverability_score, and catch-all, role-based, disposable, and consumer flags. Report the exact returned verdict and score. An 'ok' verdict is a deliverability estimate, not a guarantee or proof of current employment.",
      inputSchema: z.object({ email: emailSchema }),
      execute: (input, { abortSignal }) =>
        fiberRequest("/v1/validate-email/single", input, abortSignal),
    }),
    fiber_lookup_email: tool({
      description: "Find a person's profile from a known email address using Fiber reverse lookup. An empty result or rejection means no matching person was resolved. This lookup does not validate email deliverability; use fiber_validate_email for that.",
      inputSchema: z.object({ email: emailSchema }),
      execute: (input, { abortSignal }) =>
        fiberRequest("/v1/email-to-person/single", input, abortSignal),
    }),
    fiber_get_credits: tool({
      description: "Read the Fiber account's current credit balance and live per-operation pricing. This operation does not charge credits. Check before starting Fiber research or contact lookups. Actual charges are returned in chargeInfo by each paid operation.",
      inputSchema: z.object({}),
      execute: (_input, { abortSignal }) =>
        fiberRequest("/v1/get-org-credits", undefined, abortSignal, 15_000),
    }),
  };
}
