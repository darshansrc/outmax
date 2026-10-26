import { z } from "zod";
import { APICallError, NoObjectGeneratedError, RetryError, type LanguageModelUsage } from "ai";
import { ExaError, type AgentRun } from "exa-js";
import { cleanLeads, icpSchema, leadSchema, TARGET_COUNT } from "./leads";
import { isActive, RouteError } from "./lead-runs";

export const PROTOTYPE_APP = "outmax-orchestrated-contacts";
const text = z.string().trim().min(1);
// OpenAI structured output rejects JSON Schema format: "uri".
// Custom refinement keeps HTTP(S) validation locally without emitting that format.
const httpUrl = z.string().refine(
  (value) => z.httpUrl().safeParse(value).success,
  "Must be an HTTP(S) URL.",
).describe("An absolute HTTP or HTTPS URL.");

export const prototypeIcpSchema = icpSchema.extend({
  mustMeetCriteria: z.array(text).min(1).max(12).describe(
    "Hard requirements: buyer organization type and explicit user constraints. Keep inferred preferences separate.",
  ),
});
export const companySchema = z.object({
  companyName: text,
  website: httpUrl.describe("The company's official employer website, not a LinkedIn company profile, directory listing or job-board URL."),
  location: text.nullable(),
  businessType: text,
  fitExplanation: text,
  sourceUrls: z.array(httpUrl).min(1),
  qualificationEvidence: z.array(z.object({
    criterion: text.describe("Exact mustMeetCriteria item being supported."),
    quote: text.max(1_000).describe("Exact quotation from an observed Exa Search excerpt."),
    sourceUrl: httpUrl,
  })).min(1),
});
export const selectionSchema = z.object({
  icp: prototypeIcpSchema,
  companies: z.array(companySchema).max(TARGET_COUNT),
  shortfallReason: text.nullable(),
});
export type Selection = z.infer<typeof selectionSchema>;

const contactFields = leadSchema.pick({
  contactName: true, jobTitle: true, workEmail: true, linkedInUrl: true,
  contactDataSource: true, contactSourceUrls: true,
  emailVerificationStatus: true, emailVerificationEvidence: true,
});
export const contactResultSchema = z.object({
  contacts: z.array(contactFields.extend({
    companyWebsite: z.httpUrl().describe("The exact supplied company website; never substitute a company."),
    employerWebsite: z.httpUrl().nullable().describe("Employer website supported by the retrieved person's current employment record."),
  })).max(TARGET_COUNT),
  shortfallReason: text.nullable(),
});
export const emptyContact = {
  contactName: null, jobTitle: null, workEmail: null, linkedInUrl: null,
  contactDataSource: null, contactSourceUrls: null,
  emailVerificationStatus: null, emailVerificationEvidence: null,
};

export function companyDomain(url: string) {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}
export function evidenceUrl(url: string) {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.href.replace(/\/$/, "");
}
const normalizeQuote = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();

export function validateProductSource(productWebsite: string, sources: Map<string, string>) {
  if (![...sources].some(([url, excerpt]) => companyDomain(url) === companyDomain(productWebsite) && excerpt.trim())) {
    throw new RouteError("Exa Search did not return usable content from the product website.", 502);
  }
}

export function validateSelection(selection: Selection, productWebsite: string, sources: Map<string, string>) {
  validateProductSource(productWebsite, sources);
  const domains = new Set<string>();
  const names = new Set<string>();
  for (const company of selection.companies) {
    const companyUrl = new URL(company.website);
    if (companyDomain(company.website) === "linkedin.com" && companyUrl.pathname.startsWith("/company/")) {
      throw new RouteError("A LinkedIn company profile cannot replace the company's official employer website.", 502);
    }
    if (companyDomain(company.website) === companyDomain(productWebsite)) {
      throw new RouteError("The product company cannot be returned as a lead.", 502);
    }
    const domain = companyDomain(company.website);
    const name = company.companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (domains.has(domain) || names.has(name)) throw new RouteError("Consolidate duplicate companies before contact lookup.", 502);
    domains.add(domain);
    names.add(name);
    if (company.sourceUrls.some((url) => !sources.has(evidenceUrl(url)))) {
      throw new RouteError("A company cites a source not returned by Exa Search.", 502);
    }
    for (const criterion of selection.icp.mustMeetCriteria) {
      const supported = company.qualificationEvidence.some((proof) =>
        proof.criterion === criterion
        && !!sources.get(evidenceUrl(proof.sourceUrl))
        && normalizeQuote(sources.get(evidenceUrl(proof.sourceUrl))!).includes(normalizeQuote(proof.quote)),
      );
      if (!supported) throw new RouteError("A company lacks observed source evidence for a required ICP criterion.", 502);
    }
  }
}

export function qualifySelection(selection: Selection, productWebsite: string, sources: Map<string, string>) {
  // Still require real product content when no companies survive qualification.
  validateSelection({ ...selection, companies: [] }, productWebsite, sources);
  const companies: Selection["companies"] = [];
  const rejected: { companyName: string; reason: string }[] = [];
  for (const company of selection.companies) {
    try {
      validateSelection({ ...selection, companies: [...companies, company] }, productWebsite, sources);
      companies.push(company);
    } catch (error) {
      if (!(error instanceof RouteError)) throw error;
      rejected.push({ companyName: company.companyName, reason: error.message });
    }
  }
  return {
    selection: {
      ...selection, companies,
      shortfallReason: [
        selection.shortfallReason,
        rejected.length ? `${rejected.length} companies excluded for duplicate or unsupported qualification evidence.` : null,
      ].filter(Boolean).join(" ") || null,
    },
    rejected,
  };
}

export function sumTokenUsage(usages: LanguageModelUsage[]) {
  if (!usages.length) return null;
  const sum = (read: (usage: LanguageModelUsage) => number | undefined) => {
    const values = usages.map(read).filter((value): value is number => value !== undefined);
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  };
  return {
    inputTokens: sum((usage) => usage.inputTokens),
    outputTokens: sum((usage) => usage.outputTokens),
    totalTokens: sum((usage) => usage.totalTokens),
    inputTokenDetails: {
      noCacheTokens: sum((usage) => usage.inputTokenDetails.noCacheTokens),
      cacheReadTokens: sum((usage) => usage.inputTokenDetails.cacheReadTokens),
      cacheWriteTokens: sum((usage) => usage.inputTokenDetails.cacheWriteTokens),
    },
    outputTokenDetails: {
      textTokens: sum((usage) => usage.outputTokenDetails.textTokens),
      reasoningTokens: sum((usage) => usage.outputTokenDetails.reasoningTokens),
    },
  };
}

// Company selection belongs to generateText. Exa can only add contact fields for those exact companies.
export function prototypeResult(selection: Selection, run: AgentRun | null) {
  const parsed = run?.status === "completed"
    ? contactResultSchema.safeParse(run.output?.structured) : null;
  if (parsed && !parsed.success) throw new RouteError("Exa returned an invalid contact structure.", 502);
  const rows = parsed?.success ? parsed.data.contacts : [];
  const merged = selection.companies.map((company) => {
    const domain = companyDomain(company.website);
    const contact = rows.find((row) => companyDomain(row.companyWebsite) === domain
      && row.employerWebsite && companyDomain(row.employerWebsite) === domain);
    return { ...company, ...emptyContact, ...(contact ? contactFields.parse(contact) : {}) };
  });
  const { leads, ...cleanup } = cleanLeads(merged);
  return {
    icp: selection.icp, leads, returnedCount: leads.length,
    shortfallReason: leads.length === TARGET_COUNT ? null : [
      selection.shortfallReason ?? `Only ${leads.length} companies had enough evidence to qualify.`,
      cleanup.duplicatesRemoved ? `${cleanup.duplicatesRemoved} duplicate companies removed.` : null,
    ].filter(Boolean).join(" "),
    contactLookupReason: run && isActive(run)
      ? "Contact lookup continues. Retrieve the same run with the status URL."
      : run && run.status !== "completed" ? `Contact lookup ${run.status}.`
      : parsed?.success ? parsed.data.shortfallReason : "No contact lookup was performed.",
    runId: run?.id ?? null, status: run?.status ?? "completed",
    stopReason: run?.stopReason ?? null, cleanup,
  };
}

export function prototypeSelection(run: AgentRun) {
  const metadata = run.request?.metadata;
  if (!metadata || typeof metadata !== "object" || !("app" in metadata) || metadata.app !== PROTOTYPE_APP) {
    throw new RouteError("This is not an orchestrated contact lookup run.", 404);
  }
  let selection: unknown = metadata && typeof metadata === "object" && "selection" in metadata ? metadata.selection : null;
  if (typeof selection === "string") {
    try { selection = JSON.parse(selection); }
    catch { throw new RouteError("The run's saved company selection is invalid.", 502); }
  }
  const parsed = selectionSchema.safeParse(selection);
  if (!parsed.success) {
    const fields = parsed.error.issues.slice(0, 3).map((issue) => `${issue.path.join(".") || "selection"}: ${issue.code}`).join("; ");
    throw new RouteError(`The saved company selection failed validation (${fields}).`, 502);
  }
  return parsed.data;
}

function redactText(value: string) {
  let safe = value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email redacted]");
  for (const key of ["BEDROCK_API_KEY", "EXA_API_KEY", "UPSTASH_REDIS_REST_TOKEN"]) {
    const secret = process.env[key];
    if (secret) safe = safe.replaceAll(secret, "[credential redacted]");
  }
  return safe;
}

export function prototypeErrorDetails(error: unknown) {
  const upstream = RetryError.isInstance(error) ? error.lastError : error;
  const gatewayError = upstream instanceof Error && (upstream.name.startsWith("Gateway") || APICallError.isInstance(upstream))
    ? upstream as Error & { statusCode?: number; generationId?: string; isRetryable?: boolean } : null;
  const exaError = upstream instanceof ExaError ? upstream : null;
  let exaValidationIssues: { code: string; path: (string | number)[]; message: string }[] | null = null;
  if (exaError?.detail) {
    try {
      const detail = typeof exaError.detail === "string" ? JSON.parse(exaError.detail) : exaError.detail;
      const issues = z.array(z.object({
        code: z.string(), path: z.array(z.union([z.string(), z.number()])), message: z.string(),
      })).safeParse(detail);
      if (issues.success) exaValidationIssues = issues.data.slice(0, 10).map((issue) => ({
        ...issue, message: redactText(issue.message).slice(0, 300),
      }));
    } catch { /* Unrecognized error detail is omitted rather than dumped. */ }
  }
  // Never serialize the exception, request headers, response body or APICallError cause.
  return {
    errorType: error instanceof Error ? error.name : "UnknownError",
    upstreamErrorType: gatewayError?.name ?? null,
    upstreamStatus: gatewayError?.statusCode ?? null,
    upstreamMessage: gatewayError ? redactText(gatewayError.message).slice(0, 1_500) : null,
    gatewayGenerationId: gatewayError?.generationId ?? null,
    isRetryable: gatewayError?.isRetryable ?? null,
    retryErrorCount: RetryError.isInstance(error) ? error.errors.length : null,
    exaStatus: exaError?.statusCode ?? null,
    exaMessage: exaError ? redactText(exaError.message).slice(0, 1_500) : null,
    exaErrorCode: exaError?.code ?? null,
    exaRequestId: exaError?.requestId ?? null,
    exaValidationIssues,
    structuredOutputMessage: NoObjectGeneratedError.isInstance(upstream) ? upstream.message : null,
    structuredOutputCause: NoObjectGeneratedError.isInstance(upstream) && upstream.cause instanceof Error
      ? upstream.cause.name : null,
  };
}

export function prototypeLogger(requestId: string) {
  const startedAt = Date.now();
  return (step: string, status: string, data: Record<string, unknown> = {}) => {
    // Useful inputs/results, without email addresses, full contact records, website bodies or credentials.
    const line = JSON.stringify({ requestId, step, status, elapsedMs: Date.now() - startedAt, ...data }, (_key, value) => {
      if (typeof value !== "string") return value;
      return redactText(value);
    });
    if (status === "error" || status === "timeout") console.error(line);
    else console.log(line);
  };
}
