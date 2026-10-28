import type { Lead } from "../leads";
import { MAX_SEARCH_LEADS, type DraftEmail, type DraftState, type TokenUsage } from "../onboarding";
import { writeLeadDrafts, type DraftSender } from "../onboarding-drafts";
import type { OnboardingContext } from "../onboarding-store";
import { OnboardingStore } from "../onboarding-store";
import { costOf, emailFromName, fiberConfigured, readAgentLookup, revealFromLinkedIn, startAgentLookup, type FiberEmail } from "./fiber";
import { fetchCompanyPages } from "../web-search";
import { agentLog, short, withRunLog } from "./log";
import { domainOf, type SearchUsage } from "./search";
import { findContact, planAngles, scout, verify, type Brief, type Candidate, type WebContact } from "./subagents";

const count = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
};

/** Safety stops instead of a cost cap: companies checked and planning passes before settling for fewer leads. */
const maxChecked = (target: number) => Math.max(40, target * 4);
const maxPlans = (target: number) => 2 + Math.ceil(target / 10);
const WORKERS = count("OUTMAX_WORKERS", 10);
const SCOUTS = 6;
/** Exa agent lookups per search, only for companies where the web found nobody. Each costs about $0.12. */
const MAX_AGENT_LOOKUPS = count("OUTMAX_EXA_AGENT_LOOKUPS", 3);
/** Extra companies checked in parallel beyond what's needed, since some get rejected. */
const OVERSHOOT = 3;
/**
 * A round stops starting work after ROUND_MS. The longest unit started before then is a web
 * contact call plus a Fiber call, so the round ends inside the route's 300 s maxDuration.
 */
const ROUND_MS = 120_000;
const CALL_MS = 100_000;
const FIBER_MS = 60_000;
/** Drafts are written in small batches as leads become ready, a few batches at a time. */
const DRAFT_BATCH = 5;
const DRAFTERS = 3;
const DRAFT_MS = 100_000;

export type Prospect = {
  domain: string;
  companyName: string;
  website: string;
  location: string | null;
  fitExplanation: string;
  sourceUrls: string[];
  score: number;
  contact: "pending" | "agent" | "done";
  webChecked: boolean;
  agentRunId: string | null;
  contactName: string | null;
  jobTitle: string | null;
  workEmail: string | null;
  emailStatus: FiberEmail["status"];
  linkedInUrl: string | null;
  contactSources: ("web" | "fiber" | "exa")[];
  contactSourceUrls: string[];
  /** Missing on searches from before drafts were written per lead. */
  draftStatus?: "pending" | "writing" | "ready" | "failed";
  drafts?: DraftEmail[];
};

export type Costs = {
  searches: number; searchDollars: number;
  modelCalls: number; inputTokens: number; cachedInputTokens: number; outputTokens: number;
  agentRuns: number; agentDollars: number; fiberLookups: number; fiberCredits: number;
  draftTokens?: TokenUsage;
};

export type AgentState = {
  status: "running" | "completed" | "failed";
  target: number;
  stage: string;
  startedAt: string;
  completedAt: string | null;
  plans: number;
  /** Absolute caps after "find more"; otherwise derived from the target. */
  budget?: { checks: number; plans: number };
  angles: { label: string; query: string; done: boolean }[];
  seen: string[];
  queue: Candidate[];
  checked: number;
  accepted: Prospect[];
  rejected: { companyName: string; website: string; reason: string }[];
  costs: Costs;
  failures: number;
  shortfallReason: string | null;
  error: string | null;
};

export function initialState(startedAt: string, target: number): AgentState {
  return {
    status: "running",
    target,
    stage: "Planning searches",
    startedAt,
    completedAt: null,
    plans: 0,
    angles: [],
    seen: [],
    queue: [],
    checked: 0,
    accepted: [],
    rejected: [],
    costs: { searches: 0, searchDollars: 0, modelCalls: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, agentRuns: 0, agentDollars: 0, fiberLookups: 0, fiberCredits: 0 },
    failures: 0,
    shortfallReason: null,
    error: null,
  };
}

const nameKey = (name: string) => name.toLowerCase().replace(/&/g, "and").replace(/\b(inc|llc|ltd|gmbh|limited|corp|co|sa|sp z o o)\b/g, "").replace(/[^a-z0-9]/g, "");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function toLead(prospect: Prospect): Lead {
  const hasContact = Boolean(prospect.contactName || prospect.workEmail || prospect.linkedInUrl);
  const contactSourceUrls = prospect.contactSourceUrls.length ? prospect.contactSourceUrls : [prospect.linkedInUrl ?? prospect.website];
  const labels = { web: "Web search", fiber: "Fiber", exa: "Fiber via Exa agent" };
  const verified = prospect.workEmail && prospect.emailStatus === "valid";
  return {
    companyName: prospect.companyName,
    website: prospect.website,
    location: prospect.location,
    fitExplanation: prospect.fitExplanation,
    sourceUrls: prospect.sourceUrls,
    contactName: prospect.contactName,
    jobTitle: prospect.jobTitle,
    workEmail: prospect.workEmail,
    linkedInUrl: prospect.linkedInUrl,
    contactDataSource: hasContact ? prospect.contactSources.map((source) => labels[source]).join(" + ") || labels.web : null,
    contactSourceUrls: hasContact ? contactSourceUrls.slice(0, 4) : null,
    emailVerificationStatus: prospect.workEmail ? (verified ? "verified" : "unverified") : null,
    emailVerificationEvidence: verified
      ? { email: prospect.workEmail!, source: "Fiber", result: "verified", sourceUrl: prospect.linkedInUrl ?? prospect.website }
      : null,
  };
}

class Round {
  private readonly deadline = Date.now() + ROUND_MS;
  private scouting = 0;
  private verifying = 0;
  private contacting = 0;
  private drafting = 0;
  private planning = false;
  /** Set once no more leads can arrive this round, so the drafter can finish. */
  private searchDone = false;
  private readonly claimed = new Set<string>();
  private readonly background = new Set<Promise<unknown>>();
  private saving: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: OnboardingStore,
    private readonly runId: string,
    private readonly brief: Brief,
    private readonly sender: DraftSender,
    readonly state: AgentState,
  ) {}

  private get open() {
    return Date.now() < this.deadline && this.state.status === "running";
  }

  private get target() {
    return this.state.target ?? 20;
  }

  private get needed() {
    return this.target - this.state.accepted.length;
  }

  private get maxChecked() {
    return this.state.budget?.checks ?? maxChecked(this.target);
  }

  private get maxPlans() {
    return this.state.budget?.plans ?? maxPlans(this.target);
  }

  private get exhausted() {
    const { state } = this;
    return state.checked >= this.maxChecked || (!state.queue.length && !this.scouting && !this.planning
      && state.angles.every((angle) => angle.done) && state.plans >= this.maxPlans);
  }

  private get skip() {
    return [this.brief.business.name, domainOf(this.brief.website) ?? "", ...this.brief.business.competitors, ...this.brief.profile.exclusions, ...this.state.seen];
  }

  /** Saves are chained so a slow write never lands after a newer one. */
  save() {
    const { state } = this;
    const waiting = state.accepted.filter((item) => item.contact === "agent").length;
    state.stage = [
      this.planning && (state.plans ? "Planning new search angles" : "Planning searches"),
      this.scouting && `Searching ${plural(this.scouting, "angle", "angles")}`,
      this.verifying && `Checking ${plural(this.verifying, "company", "companies")}`,
      this.contacting && `Finding ${plural(this.contacting, "email", "emails")}`,
      this.drafting && "Writing emails",
      waiting && `Waiting on ${plural(waiting, "Exa lookup", "Exa lookups")}`,
    ].filter(Boolean).join(" · ") || state.stage;
    this.saving = this.saving.then(() => this.store.saveAgent(this.runId, state)).catch(() => {});
    return this.saving;
  }

  private addUsage(usage: SearchUsage) {
    this.state.costs.searches += usage.searches;
    this.state.costs.searchDollars += usage.exaDollars;
    for (const key of ["modelCalls", "inputTokens", "cachedInputTokens", "outputTokens"] as const) {
      this.state.costs[key] = (this.state.costs[key] ?? 0) + usage[key];
    }
  }

  private spawn(work: Promise<unknown>) {
    this.background.add(work);
    void work.finally(() => this.background.delete(work));
  }

  private async plan() {
    const { state } = this;
    this.planning = true;
    await this.save();
    try {
      const recent = state.rejected.slice(-15).map((item) => `${item.companyName}: ${item.reason}`).join("\n") || null;
      agentLog(`plan #${state.plans + 1} · planning search angles`, { rejectedSoFar: state.rejected.length });
      const { angles, usage } = await planAngles(this.brief, { used: state.angles.map((angle) => angle.query), rejectionSummary: recent, signal: AbortSignal.timeout(CALL_MS) });
      this.addUsage(usage);
      agentLog(`plan #${state.plans + 1} · ${angles.length} angles`, { angles: angles.map((angle) => angle.label) });
      state.angles.push(...angles.map((angle) => ({ ...angle, done: false })));
    } finally {
      state.plans++;
      this.planning = false;
      await this.save();
    }
  }

  private async scoutAngle(angle: AgentState["angles"][number]) {
    angle.done = true;
    this.scouting++;
    await this.save();
    try {
      agentLog(`scout "${angle.label}" · start`, { query: short(angle.query, 200) });
      const { candidates, usage } = await scout(this.brief, angle, this.skip, AbortSignal.timeout(CALL_MS));
      this.addUsage(usage);
      const seen = new Set(this.state.seen);
      const names = new Set(this.skip.map(nameKey));
      const added: string[] = [];
      for (const candidate of candidates) {
        if (seen.has(candidate.domain) || names.has(nameKey(candidate.companyName))) continue;
        seen.add(candidate.domain);
        names.add(nameKey(candidate.companyName));
        this.state.seen.push(candidate.domain);
        this.state.queue.push(candidate);
        added.push(candidate.domain);
      }
      agentLog(`scout "${angle.label}" · ${added.length} new of ${candidates.length} candidates`, { added, queue: this.state.queue.length });
    } catch (error) {
      agentLog(`scout "${angle.label}" · failed`, { error: error instanceof Error ? short(error.message, 200) : "Unknown error" });
      console.error(JSON.stringify({ route: "agent-leads/scout", runId: this.runId, errorType: error instanceof Error ? error.name : "UnknownError" }));
    } finally {
      this.scouting--;
      await this.save();
    }
  }

  /** Keeps the queue full: scouts several angles at once and plans more when they run out. */
  private async feed() {
    const { state } = this;
    while (this.open && this.needed > 0 && state.checked < this.maxChecked) {
      if (state.queue.length < WORKERS * 2) {
        const angles = state.angles.filter((angle) => !angle.done).slice(0, Math.max(0, SCOUTS - this.scouting));
        if (angles.length) {
          for (const angle of angles) this.spawn(this.scoutAngle(angle));
        } else if (!this.scouting && !state.queue.length) {
          if (state.plans >= this.maxPlans) return;
          await this.plan().catch((error) => {
            if (state.plans >= this.maxPlans) throw error;
          });
          continue;
        }
      }
      await sleep(1_000);
    }
  }

  private applyWeb(prospect: Prospect, contact: WebContact) {
    Object.assign(prospect, {
      webChecked: true,
      contactName: contact.contactName,
      jobTitle: contact.jobTitle,
      workEmail: contact.workEmail,
      linkedInUrl: contact.linkedInUrl,
      contactSourceUrls: contact.sourceUrls,
      contactSources: contact.contactName ? ["web"] : [],
    });
  }

  /** The company's own pages, fetched once and shared by the fit check and the contact search. */
  private async companyPages(candidate: Candidate) {
    try {
      const { pages, dollars } = await fetchCompanyPages(candidate.website, { signal: AbortSignal.timeout(CALL_MS) });
      this.state.costs.searches++;
      this.state.costs.searchDollars += dollars;
      agentLog(`pages ${candidate.domain} · fetched`, { pages: pages.map((page) => page.url), dollars });
      return pages;
    } catch (error) {
      agentLog(`pages ${candidate.domain} · failed`, { error: error instanceof Error ? short(error.message, 200) : "Unknown error" });
      return undefined;
    }
  }

  /** Verifies a company and, in parallel, looks for its decision-maker on the web. */
  private async check(candidate: Candidate) {
    const { state } = this;
    this.verifying++;
    await this.save();
    agentLog(`check ${candidate.domain} · start`, { company: candidate.companyName, why: short(candidate.reason, 160) });
    const pages = await this.companyPages(candidate);
    const [verdict, web] = await Promise.allSettled([
      verify(this.brief, candidate, AbortSignal.timeout(CALL_MS), pages),
      findContact(this.brief, candidate, AbortSignal.timeout(CALL_MS), pages),
    ]);
    this.verifying--;
    state.checked++;
    if (web.status === "fulfilled") this.addUsage(web.value.usage);
    if (web.status === "fulfilled") {
      const { contact } = web.value;
      agentLog(`contact ${candidate.domain} · ${contact.contactName ? "found" : "none"}`, contact.contactName
        ? { name: contact.contactName, title: contact.jobTitle, linkedIn: contact.linkedInUrl, email: contact.workEmail }
        : undefined);
    } else {
      agentLog(`contact ${candidate.domain} · failed`, { error: web.reason instanceof Error ? short(web.reason.message, 200) : "Unknown error" });
    }
    if (verdict.status === "rejected") {
      agentLog(`check ${candidate.domain} · error`, { error: verdict.reason instanceof Error ? short(verdict.reason.message, 200) : "Unknown error" });
      state.rejected.push({ companyName: candidate.companyName, website: candidate.website, reason: "We couldn’t check this company." });
    } else {
      this.addUsage(verdict.value.usage);
      const result = verdict.value.verdict;
      if (!result.pass) {
        agentLog(`check ${candidate.domain} · rejected`, { reason: short(result.reason, 240) });
        state.rejected.push({ companyName: result.companyName, website: candidate.website, reason: result.reason });
      } else if (this.needed <= 0) {
        agentLog(`check ${candidate.domain} · passed, but target already reached`, { score: result.score });
      } else {
        agentLog(`check ${candidate.domain} · passed`, { score: result.score, accepted: state.accepted.length + 1, target: this.target });
        const prospect: Prospect = {
          domain: candidate.domain,
          companyName: result.companyName,
          website: candidate.website,
          location: result.location,
          fitExplanation: result.fitExplanation,
          sourceUrls: result.sourceUrls,
          score: result.score,
          contact: "pending",
          webChecked: false,
          agentRunId: null,
          contactName: null,
          jobTitle: null,
          workEmail: null,
          emailStatus: null,
          linkedInUrl: null,
          contactSources: [],
          contactSourceUrls: [],
        };
        if (web.status === "fulfilled") this.applyWeb(prospect, web.value.contact);
        state.accepted.push(prospect);
        this.claimed.add(prospect.domain);
        await this.save();
        await this.enrich(prospect);
        this.claimed.delete(prospect.domain);
      }
    }
    state.rejected = state.rejected.slice(-120);
    await this.save();
  }

  /** Fills in the email: web result first, then Fiber directly, then a capped Exa agent lookup. */
  private async enrich(prospect: Prospect) {
    const { state } = this;
    this.contacting++;
    await this.save();
    try {
      if (!prospect.webChecked) {
        try {
          const { contact, usage } = await findContact(this.brief, prospect, AbortSignal.timeout(CALL_MS));
          this.addUsage(usage);
          this.applyWeb(prospect, contact);
          agentLog(`contact ${prospect.domain} · ${contact.contactName ? "found" : "none"}`, contact.contactName
            ? { name: contact.contactName, title: contact.jobTitle, linkedIn: contact.linkedInUrl, email: contact.workEmail }
            : undefined);
        } catch (error) {
          agentLog(`contact ${prospect.domain} · failed`, { error: error instanceof Error ? short(error.message, 200) : "Unknown error" });
          prospect.webChecked = true;
        }
      }
      const lookup = prospect.linkedInUrl
        ? () => revealFromLinkedIn(prospect.linkedInUrl!, prospect.domain, AbortSignal.timeout(FIBER_MS))
        : prospect.contactName
          ? () => emailFromName(prospect.contactName!, prospect.domain, AbortSignal.timeout(FIBER_MS))
          : null;
      if (!prospect.workEmail && lookup && fiberConfigured()) {
        try {
          agentLog(`fiber ${prospect.domain} · ${prospect.linkedInUrl ? "LinkedIn reveal" : "lookup by name"}`, { linkedIn: prospect.linkedInUrl, name: prospect.contactName });
          const result = await lookup();
          state.costs.fiberLookups++;
          state.costs.fiberCredits += result.credits;
          const usable = result.emails.filter((item) => item.status !== "invalid");
          const best = usable.find((item) => item.status === "valid") ?? usable[0];
          if (best) {
            prospect.workEmail = best.email;
            prospect.emailStatus = best.status;
            prospect.contactSources.push("fiber");
          }
          agentLog(`fiber ${prospect.domain} · ${best ? "email found" : "no email"}`, {
            email: best?.email, status: best?.status, returned: result.emails.length, credits: result.credits,
          });
        } catch (error) {
          agentLog(`fiber ${prospect.domain} · failed`, { error: error instanceof Error ? short(error.message, 200) : "Unknown error" });
          console.error(JSON.stringify({ route: "agent-leads/fiber", runId: this.runId, message: error instanceof Error ? error.message.slice(0, 200) : null }));
        }
      }
      if (!prospect.contactName && !prospect.workEmail && state.costs.agentRuns < MAX_AGENT_LOOKUPS) {
        try {
          const run = await startAgentLookup(
            { domain: prospect.domain, companyName: prospect.companyName, titles: this.brief.profile.buyerTitles },
            { app: "outmax", flow: "onboarding-contact", runId: this.runId },
          );
          state.costs.agentRuns++;
          prospect.agentRunId = run.id;
          prospect.contact = "agent";
          agentLog(`exa agent ${prospect.domain} · started`, { exaRunId: run.id, used: state.costs.agentRuns, max: MAX_AGENT_LOOKUPS });
          return;
        } catch (error) {
          agentLog(`exa agent ${prospect.domain} · failed to start`, { error: error instanceof Error ? short(error.message, 200) : "Unknown error" });
        }
      }
      prospect.contact = "done";
      agentLog(`lead ${prospect.domain} · ready`, { name: prospect.contactName, email: prospect.workEmail, emailStatus: prospect.emailStatus, sources: prospect.contactSources });
    } finally {
      this.contacting--;
      await this.save();
    }
  }

  private async pollAgents() {
    const waiting = this.state.accepted.filter((item) => item.contact === "agent" && item.agentRunId);
    await Promise.allSettled(waiting.map(async (prospect) => {
      const { done, run, contact } = await readAgentLookup(prospect.agentRunId!);
      if (!done) return;
      this.state.costs.agentDollars += costOf(run);
      prospect.contact = "done";
      agentLog(`exa agent ${prospect.domain} · ${contact?.contactName || contact?.workEmail ? "found" : "nothing"}`, {
        name: contact?.contactName, email: contact?.workEmail, dollars: costOf(run),
      });
      if (!contact) return;
      prospect.contactName = contact.contactName;
      prospect.jobTitle = contact.jobTitle;
      const email = contact.workEmail?.toLowerCase().trim();
      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) prospect.workEmail = email;
      if (contact.linkedInUrl && /^https:\/\/([a-z]+\.)?linkedin\.com\/in\//i.test(contact.linkedInUrl)) {
        prospect.linkedInUrl = contact.linkedInUrl;
        prospect.contactSourceUrls.push(contact.linkedInUrl);
      }
      if (prospect.contactName || prospect.workEmail) prospect.contactSources.push("exa");
    }));
  }

  private draftable() {
    return this.state.accepted.filter((item) => item.contact === "done" && (item.draftStatus ?? "pending") === "pending");
  }

  private async writeDrafts(batch: Prospect[]) {
    const { state } = this;
    agentLog(`drafts · writing ${batch.length}`, { leads: batch.map((item) => item.domain) });
    try {
      const { sequences, tokens } = await writeLeadDrafts(this.sender, batch.map(toLead), { timeoutMs: DRAFT_MS });
      batch.forEach((item, index) => {
        item.drafts = sequences[index] ?? [];
        item.draftStatus = item.drafts.length ? "ready" : "failed";
      });
      const usage = state.costs.draftTokens ?? { modelCalls: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };
      usage.modelCalls++;
      usage.inputTokens += tokens.inputTokens ?? 0;
      usage.cachedInputTokens += tokens.inputTokenDetails?.cacheReadTokens ?? 0;
      usage.outputTokens += tokens.outputTokens ?? 0;
      state.costs.draftTokens = usage;
      agentLog(`drafts · done ${batch.length}`, { failed: batch.filter((item) => item.draftStatus === "failed").map((item) => item.domain) });
    } catch (error) {
      for (const item of batch) item.draftStatus = "failed";
      agentLog("drafts · failed", { leads: batch.map((item) => item.domain), error: error instanceof Error ? short(error.message, 200) : "Unknown error" });
    }
    await this.save();
  }

  /** Writes drafts for leads as soon as their contact lookup finishes. */
  private async drafter() {
    while (Date.now() < this.deadline && this.state.status !== "failed") {
      const batch = this.drafting < DRAFTERS ? this.draftable().slice(0, DRAFT_BATCH) : [];
      if (batch.length) {
        for (const item of batch) item.draftStatus = "writing";
        this.drafting++;
        this.spawn(this.writeDrafts(batch).finally(() => { this.drafting--; }));
        continue;
      }
      if (this.searchDone && !this.drafting && !this.draftable().length) return;
      await sleep(3_000);
    }
  }

  private resetDrafts(statuses: Prospect["draftStatus"][]) {
    for (const item of this.state.accepted) {
      if (statuses.includes(item.draftStatus)) item.draftStatus = "pending";
    }
  }

  /** Writes any missing drafts without searching. Used to retry failed drafts on a finished search. */
  async draftsOnly(retryFailed: boolean) {
    this.resetDrafts(retryFailed ? ["writing", "failed"] : ["writing"]);
    this.searchDone = true;
    await this.drafter();
    await Promise.allSettled(this.background);
    await this.save();
  }

  private async worker() {
    const { state } = this;
    while (this.open) {
      const pending = state.accepted.find((item) => item.contact === "pending" && !this.claimed.has(item.domain));
      if (pending) {
        this.claimed.add(pending.domain);
        await this.enrich(pending);
        this.claimed.delete(pending.domain);
        continue;
      }
      const room = state.accepted.length + this.verifying < this.target + OVERSHOOT
        && state.checked + this.verifying < this.maxChecked;
      if (this.needed > 0 && room && state.queue.length) {
        await this.check(state.queue.shift()!);
        continue;
      }
      const moreComing = this.scouting > 0 || this.planning || this.verifying > 0 || (this.needed > 0 && !this.exhausted);
      if (!moreComing) return;
      await sleep(1_000);
    }
  }

  async run() {
    const { state } = this;
    agentLog("round · start", { target: this.target, accepted: state.accepted.length, checked: state.checked, queue: state.queue.length, angles: state.angles.length });
    this.resetDrafts(["writing"]);
    const drafting = this.drafter();
    await this.pollAgents();
    if (!state.angles.length && state.plans < this.maxPlans) await this.plan();
    await Promise.all([this.feed(), ...Array.from({ length: WORKERS }, () => this.worker())]);
    await Promise.allSettled(this.background);

    while (this.open && state.accepted.some((item) => item.contact === "agent")) {
      await this.save();
      await sleep(5_000);
      await this.pollAgents();
    }
    this.searchDone = true;
    await drafting;
    await Promise.allSettled(this.background);
    const unfinished = state.accepted.some((item) => item.contact !== "done" || !["ready", "failed"].includes(item.draftStatus ?? "pending"));
    if (!unfinished && (this.needed <= 0 || this.exhausted)) {
      state.status = "completed";
      state.completedAt = new Date().toISOString();
      state.stage = "Done";
      if (this.needed > 0) {
        state.shortfallReason = `Found ${state.accepted.length} of ${this.target} after checking ${state.checked} companies; ${state.rejected.length} didn’t pass.`;
      }
    }
    agentLog(`round · ${state.status === "completed" ? "search complete" : "end, continuing next round"}`, {
      accepted: state.accepted.length, target: this.target, checked: state.checked, rejected: state.rejected.length,
      exaSearches: state.costs.searches, exaDollars: Math.round(state.costs.searchDollars * 1000) / 1000,
      fiberCredits: state.costs.fiberCredits, tokens: { in: state.costs.inputTokens, out: state.costs.outputTokens },
      ...(state.shortfallReason ? { shortfall: state.shortfallReason } : {}),
    });
    await this.save();
  }
}

/** Runs one bounded round. Safe to call from every poll: only one round runs at a time. */
export async function advanceAgentRun(runId: string, context: OnboardingContext) {
  const store = new OnboardingStore();
  if (!await store.claimAgent(runId)) return;
  try {
    const state = await store.getAgent(runId);
    if (!state || state.status !== "running") return;
    const round = new Round(store, runId, briefOf(context), context, state);
    try {
      await withRunLog(runId, () => round.run());
      state.failures = 0;
    } catch (error) {
      console.error(JSON.stringify({ route: "agent-leads/round", runId, errorType: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message.slice(0, 300) : null }));
      state.failures++;
      if (state.failures >= 3) {
        state.status = "failed";
        state.error = "The search kept failing. Try again.";
        state.completedAt = new Date().toISOString();
      }
    }
    await round.save();
  } finally {
    await store.releaseAgent(runId).catch(() => {});
  }
}

const briefOf = (context: OnboardingContext): Brief => ({ website: context.website, business: context.business, profile: context.profile });

/** Drafts for the run view: finished sequences, plus which leads are still being written or failed. */
export function agentDrafts(state: AgentState): DraftState {
  const sequences: Record<number, DraftEmail[]> = {};
  const pending: number[] = [];
  const failed: number[] = [];
  state.accepted.forEach((item, index) => {
    if (item.draftStatus === "ready" && item.drafts?.length) sequences[index] = item.drafts;
    else if (item.draftStatus === "failed") failed.push(index);
    else pending.push(index);
  });
  return { status: "ready", sequences, usage: state.costs.draftTokens, pending, failed };
}

/** True when this search writes drafts per lead. Older finished searches wrote them all at the end. */
export function draftsPerLead(state: AgentState) {
  return state.status === "running" || state.accepted.some((item) => item.draftStatus !== undefined);
}

export class SearchBusyError extends Error {}

/**
 * Continues a finished search until it has `more` additional leads. Companies already checked
 * are never checked again, and new leads get drafts as they arrive.
 */
export async function extendAgentRun(runId: string, more: number) {
  const store = new OnboardingStore();
  if (!await store.claimAgent(runId)) throw new SearchBusyError("This search is still finishing. Try again in a moment.");
  try {
    const state = await store.getAgent(runId);
    if (!state) return null;
    if (state.status !== "completed") throw new SearchBusyError("This search is still running.");
    if (!draftsPerLead(state)) {
      const legacy = await store.getDrafts(runId);
      if (legacy?.status === "ready") state.costs.draftTokens ??= legacy.usage;
      state.accepted.forEach((item, index) => {
        const sequence = legacy?.status === "ready" ? legacy.sequences[index] : undefined;
        item.drafts = sequence ?? [];
        item.draftStatus = sequence?.length ? "ready" : "pending";
      });
    }
    state.target = Math.min(MAX_SEARCH_LEADS, state.accepted.length + more);
    const added = state.target - state.accepted.length;
    state.budget = { checks: state.checked + maxChecked(added), plans: state.plans + maxPlans(added) };
    state.status = "running";
    state.completedAt = null;
    state.shortfallReason = null;
    state.failures = 0;
    state.stage = "Finding more leads";
    await store.saveAgent(runId, state);
    agentLog(`search ${runId.slice(-8)} · find more`, { more, target: state.target });
    return state;
  } finally {
    await store.releaseAgent(runId).catch(() => {});
  }
}

/** Finishes drafts on a finished search, optionally retrying failed ones. */
export async function finishAgentDrafts(runId: string, context: OnboardingContext, { retryFailed = false } = {}) {
  const store = new OnboardingStore();
  if (!await store.claimAgent(runId)) return;
  try {
    const state = await store.getAgent(runId);
    if (!state || state.status !== "completed") return;
    const round = new Round(store, runId, briefOf(context), context, state);
    await withRunLog(runId, () => round.draftsOnly(retryFailed));
  } finally {
    await store.releaseAgent(runId).catch(() => {});
  }
}
