# Outmax PRD

Status: Draft v1 · Owner: Darshan · Last updated: 2026-10-28

This document is written for two readers: people deciding what to build, and coding agents building it. Every requirement has an ID (such as `R-FIT-2`), a priority and acceptance criteria. When you change behavior, update the matching requirement here in the same change.

Priorities: **P0** blocks the paid launch. **P1** is needed within the first months after launch. **P2** comes later.

---

## 1. Summary

Outmax turns a company's website into a short list of companies likely to buy from it, then runs the outreach. Each company comes with the evidence that it fits, the person to contact and a three-step email sequence. Outmax sends that sequence from the user's own mailbox, and later reaches out on LinkedIn too.

The product promise in one sentence:

> Paste your website. In about five minutes, get 10 companies that actually fit, each with a quoted reason and a decision-maker, and Outmax starts the conversation from your own inbox.

The user stays in control: they approve the leads and the first emails, and Outmax stops the moment someone replies.

## 2. Why now, and where Outmax fits

The market for AI-assisted lead research is proven. It is also crowded.

- Clay is the category leader. It raised $115M at a $7.1B valuation in September 2026 and is on pace for about $200M in annual recurring revenue. It is powerful, but it is built for sales operations teams and takes real setup.
- Origami, a Y Combinator company, builds research agents that find companies of the right size and filter out poor fits. It passed $1M in annual recurring revenue in July 2026. It started with one industry (property management) before expanding.
- Fully autonomous "AI SDR" tools, which find leads, email them and book meetings on their own, have struggled. Public reporting describes 70–80% early churn at 11x, weak reply quality, and platform bans tied to scraped LinkedIn data. The lesson: autonomy without human review produces activity, not pipeline.

The gap Outmax fills: founders and small teams who need a handful of well-chosen prospects this week, contacted well. They don't want to learn Clay, buy a contact database, stitch together a sending tool or hire an SDR.

What makes Outmax different:

1. **Proof, not guesses.** Every company passes a fit check backed by quotes from public pages. The product shows why each company was accepted, and why rejected companies didn't pass.
2. **Instant setup.** The input is a website. Outmax writes the ideal customer profile, and the user only reviews it.
3. **Small and precise.** 10 good companies beat 2,000 rows to clean up, and a few well-researched emails per day protect the user's domain.
4. **Automated, but supervised.** Outmax sends and follows up on its own, but the user approves who gets contacted and what the first email says, and every reply goes straight to the user. Autonomous SDR tools failed by sending volume without review; Outmax sends less, to better-chosen people.

## 3. Target users

**Primary: the founder doing sales.** A founder of a company with 1–20 people, selling a B2B product or service, usually with no full-time salesperson. They do outbound in bursts and send 20–100 emails a week by hand. They want a list they would be proud to email.

**Secondary: a small agency or consultancy.** Dev shops, design studios and marketing agencies. Their buyers are harder to find through company pages, because the buying signal is intent ("we need a team"), not a company attribute.

**Not a target for v1:** enterprise sales teams, RevOps teams that already run Clay or Apollo, and anyone who wants to send thousands of emails a day.

## 4. Problems to solve

| User problem | What Outmax does |
| --- | --- |
| "I don't know exactly who my best customer is." | Analyzes the website and writes a reviewable ideal customer profile. |
| "Lead databases give me giant companies that will never buy." | Checks each company's size and stage against the profile, with evidence. |
| "I can't tell why a lead was picked." | Shows the quoted reason for every accepted company and the rejection reason for others. |
| "Finding the right person and their email is tedious." | Finds a decision-maker and looks up a work email. |
| "Writing personal cold emails takes forever." | Writes a three-email sequence per lead (Day 1, 3 and 7). |
| "I forget to follow up, and juggling tools is a pain." | Sends the sequence from the user's mailbox and stops when someone replies. |
| "LinkedIn outreach eats my evenings." | Sends connection requests and messages alongside the emails (planned, see 7.11). |

## 5. Goals and non-goals

### Goals for v1

- **G1:** A first-time user gets a usable list without editing anything beyond the profile review.
- **G2:** At least 80% of delivered companies are judged "would email" by the user.
- **G3:** A 10-lead search finishes in 7 minutes or less (p50 is median, p90 is the 90th percentile).
- **G4:** Provider cost is at most $0.25 per delivered lead, including AI model tokens.
- **G5:** Users send sequences from their own connected mailbox, and no connected mailbox gets flagged for spam.

### Non-goals for v1

- Sending from Outmax-owned domains or shared mailboxes. Email always goes from the user's own account.
- Mailbox warmup networks (fake email exchanges between accounts to build reputation).
- High-volume sending. Daily caps are deliberately low (see R-SEND-6).
- A contact database, or bulk exports beyond 50 leads per search.
- Scraping LinkedIn or any site for contact data. Contact data comes from licensed providers.
- CRM sync, beyond CSV export.
- Real authentication and billing in the current prototype. These are needed before paid launch (see section 9).

## 6. User journey

1. **Landing.** The user pastes a website URL.
2. **Analyze.** Outmax reads the site and drafts the business summary and the ideal customer profile.
3. **Review.** The user edits the profile: ideal customer description, industries, size range, regions, must-haves, not-a-fit, leave-out, buyer titles. They pick how many leads to find (5–50, default 10).
4. **Search.** The agent plans search angles, finds candidates, checks fit, finds contacts and looks up emails. Progress is visible live: accepted, checked and rejected counts, plus the current stage.
5. **Results.** A table of companies with fit reasons, contacts and email status. Each lead opens a panel with its evidence and three drafts.
6. **Connect.** The first time, the user connects a mailbox: Google, Microsoft, or any provider over SMTP and IMAP. Later, they can also connect LinkedIn.
7. **Approve and launch.** The user approves the leads, reviews or edits the Day 1 emails, and starts the sequence. Outmax schedules sends within the daily cap and the user's working hours.
8. **Run.** Outmax sends follow-ups on schedule, watches for replies and bounces, and stops a lead's sequence the moment they reply. Replies land in the user's normal inbox, and Outmax shows them on the campaign view.

Copying drafts and exporting a CSV still work for users who prefer to send themselves.

## 7. Requirements

### 7.1 Website analysis and profile (`app/api/onboarding/analyze`)

- **R-ICP-1 (P0):** Produce a business summary and an ideal customer profile from the website alone.
  - Accept: the profile includes the ideal customer description, size range, industries, buyer titles, must-haves, not-a-fit and leave-out. Industries is never empty, and a size range is always estimated.
- **R-ICP-2 (P0):** Must-haves must be things a public page could prove (for example "sells subscriptions", "based in the EU", "has a mobile app"). Attitudes and intent ("willing to work with an agency") belong in the ideal customer description or buying signals instead.
  - Accept: on a test set of 10 websites, at most 1 generated must-have in total is unverifiable from public pages.
  - Why: the Asymmetri run rejected 3 of 4 companies for an unprovable must-have.
- **R-ICP-3 (P0):** Infer the realistic buyer's stage and size from pricing, self-serve versus demo sales, customer logos and positioning. Exclude market leaders unless the seller clearly sells upmarket.
  - Accept: for dodopayments.com, the size range covers small SaaS companies, and not-a-fit excludes large companies with in-house billing.
- **R-ICP-4 (P1):** Show the user which part of their site each profile field came from.

### 7.2 Finding candidates (`lib/agent-leads/subagents.ts`, `planAngles` and `scout`)

- **R-FIND-1 (P0):** Plan several distinct search angles, aimed at where the ideal customer is visible on the web: directories, launch sites, accelerator cohorts, job posts, competitor-alternative discussions.
- **R-FIND-2 (P0):** Never return the seller, its competitors, vendors of similar products, agencies, publishers, directories, household names or anything on the leave-out list.
- **R-FIND-3 (P0):** Re-plan when angles run dry, using recent rejection reasons to steer away from what failed.
  - Accept: a 10-lead search on each of 5 reference websites (section 10) checks at least 15 candidates before stopping.
- **R-FIND-4 (P1):** Use different angle strategies for service businesses (agencies, consultancies), whose buyers show intent through posts and job listings, not company attributes.

### 7.3 Fit check (`verify`)

- **R-FIT-1 (P0):** Accept a company only when every must-have and the industry criterion is supported by a quote that appears verbatim in a fetched page.
- **R-FIT-2 (P0):** Reject companies that are too big (more than 2× the maximum size) or too small (under half the minimum), not operating, on the not-a-fit list, or unlikely to adopt now. Always record a short, specific reason.
- **R-FIT-3 (P0):** Show rejected companies with their reasons in the results.
- **R-FIT-4 (P1):** Show a fit score and the quotes behind it in the lead panel.

### 7.4 Contacts and email (`findContact`, `lib/agent-leads/fiber.ts`)

- **R-CON-1 (P0):** Find one current decision-maker per company who matches the buyer titles. At small companies, the founder is acceptable.
- **R-CON-2 (P0):** Never invent names, LinkedIn URLs or emails. A name or email must appear verbatim in a fetched source; a LinkedIn URL must be a fetched `linkedin.com/in/` result.
- **R-CON-3 (P0):** Look up work emails in this order: an email published on the web, then Fiber by LinkedIn profile, then Fiber by name and domain. The Exa agent is the last resort, capped per search (`OUTMAX_EXA_AGENT_LOOKUPS`, default 3).
- **R-CON-4 (P0):** Label each email's status: verified (Fiber says valid) or unverified. Never call an email verified without a provider result.
  - Accept: at least 70% of delivered leads have an email; at most 5% of verified emails bounce.

### 7.5 Email drafts (`lib/onboarding-drafts.ts`)

- **R-DRAFT-1 (P0):** Write three emails per lead (Day 1, Day 3 as a reply on the same thread, Day 7 with a new angle), using that company's fit reason.
- **R-DRAFT-2 (P0):** Write in plain, human language: no filler, no restating the reader's job, under 80 words for Day 1.
- **R-DRAFT-4 (P0):** Write each lead's drafts as soon as its contact lookup finishes, not after the whole search. Failed drafts can be retried per search. (Done for the Outmax engine: batches of up to 5, 3 at a time.)
- **R-DRAFT-3 (P1):** Let the user regenerate one lead's drafts, or all drafts, with a short instruction (for example "more casual").

### 7.6 Search experience (`components/onboarding/run-view.tsx`)

- **R-RUN-1 (P0):** Let the user pick 5–50 leads, defaulting to 10.
- **R-RUN-2 (P0):** Show live progress: accepted versus target, checked, rejected and the current stage.
- **R-RUN-3 (P0):** When a search finishes short of the target, explain why in plain words and suggest the profile field to change.
  - Accept: if most rejections cite the same must-have, the message names it.
- **R-RUN-4 (P0):** CSV export with company, website, fit reason, contact, title, email, email status and LinkedIn.
- **R-RUN-5 (P1):** "Find more" lets the user pick 5–50 more leads and continues the same search without repeating companies, up to 100 leads per search. Each request gets its own check and planning budget. (Done for the Outmax engine.)

### 7.7 Cost and observability

- **R-OBS-1 (P0):** Track usage per search: Exa searches and dollars, Exa agent runs and dollars, Fiber lookups and credits, and AI model calls and tokens for the search and the drafts. Show it on the run view. (Done: `lib/run-usage.ts`.)
- **R-OBS-2 (P0):** Log each agent step to the server console with the run ID (planning, every search query, verdicts, contacts and emails). Logs can be turned off with `OUTMAX_AGENT_LOGS=0`. (Done: `lib/agent-leads/log.ts`.)
- **R-OBS-3 (P0):** Estimate a total cost per search from configured prices (`OUTMAX_PRICE_*`). (Done.)
- **R-OBS-4 (P1):** Enforce a cost ceiling per search, stopping cleanly with partial results when it's reached.

### 7.8 Speed and reliability (`lib/agent-leads/engine.ts`)

- **R-PERF-1 (P0):** Work runs in parallel: up to 6 concurrent scouts and up to 10 concurrent workers checking or enriching companies.
- **R-PERF-2 (P0):** A search survives server time limits by running in bounded rounds, about 2 minutes each, with state saved in Redis. Only one round runs at a time per search.
- **R-PERF-3 (P0):** A search that fails 3 rounds in a row is marked failed with a clear message. Leads found so far are kept.

### 7.9 Trust and compliance

- **R-TRUST-1 (P0):** Treat all fetched web content as untrusted data, never as instructions.
- **R-TRUST-2 (P0):** Use only licensed or public data sources; no scraping against a site's terms.
- **R-TRUST-3 (P0):** Never fabricate testimonials or customers on the marketing site.
- **R-TRUST-4 (P0 once sending ships):** Let any contact opt out, and suppress them in all future searches and sends for that account.

### 7.10 Email sending (new)

Mailbox connections:

- **R-SEND-1 (P0):** Connect Google (Gmail and Google Workspace) with OAuth.
  - Use the `gmail.send` scope to send. To detect replies, prefer `gmail.metadata` over full read access, and only add read scopes when a feature needs them.
  - Note: Gmail read scopes are "restricted" and require Google's app verification and a yearly third-party security assessment (CASA) before public launch. Plan for 4–8 weeks.
- **R-SEND-2 (P0):** Connect Microsoft 365 and Outlook with OAuth through Microsoft Graph (`Mail.Send`, plus `Mail.ReadBasic` for replies). Admin consent may be needed in some organizations.
- **R-SEND-3 (P1):** Connect any other provider (Zoho, Fastmail, custom domains) with SMTP for sending and IMAP for replies, using an app password.
- **R-SEND-4 (P0):** Store tokens and passwords encrypted at rest. Let the user disconnect at any time, which stops all sends from that mailbox immediately.

Sequences:

- **R-SEND-5 (P0):** Each lead gets a sequence: Day 1 email, Day 3 reply on the same thread, Day 7 new email. Follow-ups are sent as real replies (same thread, `In-Reply-To` headers) so they appear as one conversation.
- **R-SEND-6 (P0):** Respect sending limits per mailbox. Defaults: 30 new contacts a day for a new mailbox, rising to at most 50 over two weeks; sends spread across the user's working hours with random gaps; no sends on weekends unless enabled.
  - Accept: no mailbox ever exceeds its cap, even with several campaigns running.
- **R-SEND-7 (P0):** Stop a lead's sequence the moment they reply, the email bounces, or they opt out. Stop all sequences to a company when anyone there replies.
  - Accept: a follow-up is never sent after a reply has been received and detected; reply checks run at least every 5 minutes.
- **R-SEND-8 (P0):** Approval modes. "Review first" (default) means the user approves every Day 1 email before it's sent. "Auto" sends approved leads without review, and is unlocked only after the user has sent at least one reviewed campaign.
- **R-SEND-9 (P0):** Every email includes a plain-text opt-out line, and a one-click unsubscribe header (`List-Unsubscribe` with `List-Unsubscribe-Post`). The footer includes the sender's postal address where the law requires it (CAN-SPAM in the US).
- **R-SEND-10 (P0):** Before the first send, check the user's domain for SPF, DKIM and DMARC records, and explain how to fix anything missing.
- **R-SEND-11 (P1):** Pause a mailbox automatically when its bounce rate goes above 3%, or when the provider reports spam complaints. Google requires bulk senders to stay under 0.3% spam complaints.
- **R-SEND-12 (P1):** A campaign view shows each lead's status: scheduled, sent, replied, bounced, opted out or finished.
- **R-SEND-13 (P2):** Open tracking is off by default; tracking pixels hurt deliverability and are often blocked. Click tracking is optional.

### 7.11 LinkedIn outreach (planned)

LinkedIn's User Agreement prohibits using bots or other automated methods to send connection requests or messages, and LinkedIn has no public API for this outside closed partner programs. Tools that do it anyway (such as Expandi, HeyReach and Waalaxy) drive a real browser session, and LinkedIn restricts or bans the accounts it catches. The risk falls on the user's personal LinkedIn account, so the requirements below are built around that.

- **R-LI-1 (P2):** The user connects LinkedIn knowingly. Before connecting, Outmax shows a plain warning that LinkedIn may restrict their account, and the user must accept it.
- **R-LI-2 (P2):** Actions per lead: view profile, send a connection request with an optional note (at most 300 characters), and send one message after they accept. Follow-ups stop when the lead replies on LinkedIn or by email.
- **R-LI-3 (P2):** Conservative limits, well under what LinkedIn tolerates: at most 15 connection requests a day and 80 a week, at most 30 messages a day, spread across working hours with random gaps. A new connection starts lower and ramps up.
- **R-LI-4 (P2):** Stop all LinkedIn actions immediately if LinkedIn shows a warning, a CAPTCHA or a restriction, and tell the user. Never retry automatically.
- **R-LI-5 (P2):** A safer "assisted" mode as the default: Outmax prepares the request or message and the user sends it with one click, from a browser extension or the LinkedIn tab. Full automation is opt-in.
- **R-LI-6 (P2):** Email and LinkedIn run as one sequence per lead (for example: Day 1 email, Day 2 connection request, Day 4 LinkedIn message if accepted, Day 7 email), and a reply on either channel stops both.
- **Decision needed before building:** full automation, assisted mode only, or both. See open questions.

## 8. Success metrics

| Metric | Target at launch | How to measure |
| --- | --- | --- |
| Completed searches with at least 80% of the target delivered | ≥ 80% | Run state in Redis |
| "Would email" rating per lead | ≥ 80% | Thumbs up/down per lead (P1) |
| Leads with an email | ≥ 70% | Run state |
| Verified email bounce rate | ≤ 5% | User-reported bounces (P1) |
| Time to finish 10 leads | p50 ≤ 5 min, p90 ≤ 7 min | `startedAt` to `completedAt` |
| Provider cost per delivered lead | ≤ $0.25 | Usage panel and price settings |
| Reply rate on Outmax sequences | ≥ 5% | Connected mailbox reply detection |
| Positive reply rate (interested, not "unsubscribe") | ≥ 2% | AI reply classification (P1) |
| Bounce rate per mailbox | ≤ 3% | Bounce detection |
| Spam complaint rate per mailbox | < 0.1% (Google's hard limit is 0.3%) | Google Postmaster Tools, provider feedback |
| Follow-ups sent after a reply | 0 | Sequence logs |
| LinkedIn accounts restricted | 0 | User reports, R-LI-4 detection |
| Paid conversion after free search | ≥ 5% | Billing (P1) |

Reply rate is the metric that decides whether Outmax is a business. Connected mailboxes let Outmax measure it directly. Everything else feeds it.

## 9. Business model (proposal)

- **Free:** one search of up to 10 leads, so the first run shows the value.
- **Paid, pay as you go:** charge per delivered lead that has an email, for example $1–2 per lead in packs. Rejected companies and leads without an email are free.
- **Paid, subscription:** for example 100 leads a month with sending included, for a fixed price, with rollover. Sending is the reason to stay subscribed, since sequences run for weeks.
- **Add-on:** LinkedIn outreach, priced per connected LinkedIn account.
- Unit economics: at ≤ $0.25 provider cost per lead, $1 per lead leaves room for a healthy margin. Sending through the user's own mailbox adds almost no cost.

Before charging (P0 for paid launch): real authentication, billing, abuse limits per account, a terms page covering data use and sending rules, and Google and Microsoft app verification for mailbox access.

## 10. Reference test set

Use these websites to compare changes. Run a 10-lead search on each and record delivered count, "would email" rate, time and cost. Re-run after any change to prompts or the engine.

| Website | Seller type | Expected buyer |
| --- | --- | --- |
| dodopayments.com | Payments, merchant of record | Indie to mid-size SaaS, 1–50 people |
| elkagent.com | AI support agent | Companies with customer support teams |
| asymmetri-v2.vercel.app | Product development agency | Early-stage startups without an engineering team |
| rankingcopilot.com | SEO tool | Small businesses and agencies doing SEO |
| (add one) | Vertical B2B tool | To be chosen |

Paid searches cost money. Agents must ask before running a search on this set.

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| Lead quality isn't reliably good | Proof-backed fit checks, the reference test set, per-lead ratings |
| Provider costs too high | Usage tracking, a per-search cost ceiling, Exa agent capped, prefer cheap direct lookups |
| Dependence on Exa and Fiber, who could change prices or compete | Keep providers behind small modules (`lib/web-search.ts`, `lib/agent-leads/fiber.ts`) so they can be swapped |
| Clay or others ship the same flow | Focus on small teams, speed, visible evidence and price per good lead |
| Users' domains get flagged for spam | Low daily caps, warm-up ramp, SPF/DKIM/DMARC checks, auto-pause on bounces or complaints, one-click unsubscribe |
| Google or Microsoft app verification delays launch | Start verification early; launch with SMTP/IMAP or a limited test-user group meanwhile |
| A follow-up goes out after someone replied | Reply checks every 5 minutes, check again right before each send, stop the whole company on any reply |
| LinkedIn restricts users' accounts | Assisted mode by default, explicit warning and consent, conservative limits, stop on first warning |
| LinkedIn takes action against Outmax itself (as it did with Artisan) | Never use LinkedIn's name or logo in a way that suggests partnership; keep LinkedIn features separate and removable |
| Privacy and anti-spam law (GDPR, CAN-SPAM, CASL) | B2B work addresses only, a clear reason for contact, opt-out in every email, suppression lists, a data removal process |

## 12. Open questions

1. Which two or three seller types do we tune for first?
2. Charge per lead or per search? Decide after 20 paid users.
3. LinkedIn: full automation, assisted mode only, or both? Full automation is what users ask for, but it risks their accounts.
4. Do we build sending ourselves, or use a sending provider or library (such as Nylas or Unipile) to cover Gmail, Outlook, IMAP and LinkedIn faster?
5. Which mailbox ships first? Google is likely, since most target founders use Google Workspace.
6. Do we keep the Exa agent engine as an option, or remove it once the Outmax agent is reliable?

## 13. Current state (as of 2026-10-28)

Built: website analysis, profile review, lead count picker, the parallel Outmax agent engine (Gemini 4 Argon with Google Search, Fiber emails, capped Exa agent fallback), the Exa agent engine option, live progress, rejection list, email drafts, CSV export, the usage panel, agent logs, per-lead drafts written while the search runs, and "find more" on finished searches.

Known gaps:

- **R-ICP-2:** the analysis can still write unprovable must-haves.
- **R-RUN-3:** shortfall messages don't yet name the must-have to change.
- **G3 and G4:** speed and cost targets aren't yet confirmed on the reference test set.
- Authentication and billing don't exist.
- Email sending (7.10) and LinkedIn outreach (7.11) aren't built. Drafts can only be copied or exported today.

## 14. Glossary

- **Ideal customer profile:** the description of companies likely to buy, plus filters (size, industries, regions, must-haves).
- **Must-have:** a condition every accepted company has to meet, proven by a quote.
- **Not a fit:** kinds of companies to reject even if they match otherwise.
- **Leave out:** specific companies to skip, such as competitors.
- **Angle:** one search strategy for finding candidates, such as "recent Product Hunt launches".
- **Scout:** the step that runs one angle and returns candidate companies.
- **Fit check:** the step that verifies one company against the profile, with quotes.
- **Delivered lead:** an accepted company in the final results.
- **Sequence:** the timed series of emails (and later LinkedIn actions) sent to one lead, which stops when they reply.
- **Campaign:** the sequences for all leads from one search.
- **Connected mailbox:** the user's own email account, linked to Outmax by OAuth or SMTP/IMAP, that all emails are sent from.
- **Daily cap:** the most new contacts Outmax will email (or send LinkedIn requests to) from one account in a day.
- **Assisted mode:** Outmax prepares a LinkedIn action, and the user sends it with one click.
