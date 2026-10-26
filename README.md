# Outmax

The separate **orchestrated prototype** is `POST /api/leads/orchestrated`:

```bash
curl -i http://localhost:3000/api/leads/orchestrated \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Find ideal customers for https://rankingcopilot.com. Only include law firms that prepare legal directory submissions."}'
```

It uses the shared model from `lib/provider.ts` (`openai.gpt-6.1-sol` on Amazon
Bedrock) with `generateText`, `Output.object`, and the local Exa search tool from
`lib/web-search.ts` as `tools.exa_search`. The model
researches the product, infers an ICP, searches for companies, and decides which
companies qualify in three calls: an Exa research phase, a separate
`Output.object` company-selection phase without tools, and a call to the local
contact tool. This keeps the search loop separate from final JSON parsing. Selection receives bounded source excerpts.
Required criteria have quotations and URLs from those excerpts. Duplicate
companies and companies lacking supported quotations are excluded with an
explanation; deciding whether the quotations establish fit remains the model's
responsibility.

The model then calls the `exa_contacts` tool once. The tool uses the validated
company list retained by the backend, rather than having the model retype it.
It creates one Exa Agent run with Fiber enabled **only for contact
enrichment**, using a shared $5 default batch budget. Results are merged by
company domain and supported current employer; Exa cannot add or replace
companies. Unsupported contact details remain `null`, and verified emails
require matching verification evidence. This prototype uses `BEDROCK_API_KEY`
and `EXA_API_KEY`, and does not require Redis or add runs to the existing UI.
The selection is serialized into a metadata string because the live Exa API
requires string metadata values. The status endpoint parses that saved selection.

The response includes `icp`, `leads`, `returnedCount`, `shortfallReason`,
`contactLookupReason`, `runId`, `statusUrl`, `status`, `stopReason`, `usage`, and
`costDollars`. Reported search and contact-run costs are separate from AI token
usage; unreported costs are `null`. No AI dollar estimate is made. Pending
contact lookups return HTTP 202 with qualified companies and their unavailable
contact fields set to `null`. Retrieve the same contact run without creating
another:

```bash
curl -i http://localhost:3000/api/leads/orchestrated/YOUR_RUN_ID
```

The GET returns HTTP 202 while active, 200 on completion, or 502 for failed,
cancelled, or invalid outputs. It retrieves the selection stored with that
contact run and merges contacts without rerunning the orchestrator. Earlier AI
token usage and search costs are unavailable on this GET and are returned as
`null`; retain the POST response for that accounting.

Optional settings: `ORCHESTRATED_MAX_STEPS` defaults to **12** (3–40),
`ORCHESTRATED_TIMEOUT_MS` to **240000**, and the existing
`EXA_POLL_TIMEOUT_MS`, `EXA_POLL_INTERVAL_MS`, and `EXA_RUN_BUDGET_DOLLARS`
control contact polling and its budget. The step limit bounds SDK steps;
the model may run several searches in one step. Research is instructed
to aim for 24 searches, which is a prompt guideline, not an enforced cost cap.
The overall timeout bounds the request. The $5 budget applies to the contact run;
Exa searches and AI generation have separate charges. Logs contain
`requestId`, `step`, `status`, and `elapsedMs`, plus actual search inputs,
bounded result excerpts, ICP/selected-company data, token usage, polls, run
IDs, and reported costs. Emails, complete contact records, full website text,
and credentials are omitted. AI requests allow one SDK retry for retryable
upstream failures using the same model; non-retryable errors are not retried.
Model provider failures include a redacted message and upstream HTTP status. Structured-output failures identify their phase
and cause without logging model output. AI token usage is aggregated from
completed SDK steps even when a later phase fails. URL fields use a compatible string schema for
OpenAI structured output, with HTTP(S) validation applied locally.
A new POST creates a new research attempt.

`POST /api/leads` retrieves a product website with Exa, generates an ICP with
`generateText` + `Output.object` using **only** the model from `lib/provider.ts`,
and creates one Exa Agent run with Fiber enabled to find up to 20 companies and
their decision-makers. Explicit instructions in the prompt override inferred
preferences. Upstash Redis temporarily retains run snapshots and the original
ICP/accounting. The home page creates research and lists previous runs.
`/leads/{runId}` shows status, the customer profile, companies, contact details,
and supporting sources. Active run pages refresh every five seconds and stop
when the run completes or a request fails. No authentication or outreach is added.

Use Node.js 22 or newer and Bun (the repo's package manager):

```bash
bun install
bun dev
```

The existing `.env` must contain `EXA_API_KEY`, `AI_GATEWAY_API_KEY`,
`UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN`. Next.js
loads them server-side. Keep their existing values; do not put them in the curl
request or use a `NEXT_PUBLIC_` prefix. This repo enables Cache Components, which
disallows a route-level `runtime` export; the route runs on the default Node.js
runtime and imports `node:crypto`.

Example request:

```bash
curl -i http://localhost:3000/api/leads \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Find customers for https://elkagent.com. Focus on US Shopify stores."}'
```

The frontend sends `"waitForResults": false` alongside the prompt to return
HTTP 202 immediately after the run and context are saved, then opens its status
page. Omitting this option preserves the original polling behavior for curl.

List Outmax research runs:

```bash
curl -sS http://localhost:3000/api/leads
```

The response contains `runs` (summaries without contact records) and `runCount`.
The SDK fetches all pages and filters out unrelated Exa account history.
The three original Outmax runs are retained explicitly; new runs are tagged
with `metadata.app = "outmax"` so they remain visible after Redis expires.
Each summary includes its run ID, status,
timestamps, validated lead count, result availability, and known usage/costs.
Listing does not generate an ICP or start a research run.

Read an existing run's status and validated results:

```bash
curl -i http://localhost:3000/api/leads/agent_run_9bc6758d0b944872ade24721cea89899
```

Replace the ID with any run ID returned by POST or the list endpoint. On Vercel,
use `https://outmax-three.vercel.app` in place of `http://localhost:3000` after
deploying these changes and configuring the same Redis credentials.

The detail endpoint returns HTTP 202 while the run is queued/running and HTTP
200 with cleaned leads when completed. Repeat the same GET to check progress.
Active runs are refreshed from Exa; terminal snapshots are served from Redis
until their expiry. A cache miss fetches the existing run from Exa and caches it.
`source` identifies `exa` or `redis`. Failed/cancelled runs and invalid lead
structures return HTTP 502; a missing run returns HTTP 404 and an invalid ID
returns HTTP 400. Neither GET endpoint creates a run or makes an AI call.

Run snapshots and original request context use separate Redis keys under
`outmax:leads:` with a default 24-hour expiry. Reads do not extend the original
context's expiry. Previous runs and expired contexts have `icp`,
`usage.ai.tokens`, and `costDollars.exaWebsiteReported` set to `null` because
those original values are unavailable. Exa still supplies the run's status,
results, usage, and reported Agent costs. POST checks Redis before paid calls
and saves the context and initial run immediately after Exa returns a run ID.
Redis failures return HTTP 503, with the run ID if creation already succeeded.

Include exactly one public HTTP(S) product website URL. Ambiguous/missing URLs,
embedded URL credentials, malformed JSON, and empty prompts return HTTP 400.

Optional server environment variables (leave unset to use defaults):

- `EXA_RUN_BUDGET_DOLLARS`: positive dollar amount; default **5**. Sent as
  `budget.maxCostDollars` with `effort: "auto"`. This ceiling applies to the
  Agent run; website retrieval and the separate AI call have their own usage.
- `EXA_POLL_TIMEOUT_MS`: positive integer; default **120000**. Starts after run
  creation. This controls the local wait, not the lifetime of the remote run.
- `EXA_POLL_INTERVAL_MS`: positive integer; default **2000**.
- `LEADS_REDIS_TTL_SECONDS`: positive integer; default **86400** (24 hours).

A completed run returns HTTP 200 with `icp`, `leads`, `returnedCount`,
`shortfallReason`, `runId`, `usage`, and `costDollars`, plus the actual Exa
`status` and `stopReason`. The count always comes from the cleaned array.
`shortfallReason` is `null` for 20 leads and explains fewer results, including
deduplication and removal of companies without qualification evidence.

Each lead has `companyName`, `website`, `location`, `fitExplanation`,
`sourceUrls`, `contactName`, `jobTitle`, `workEmail`, `linkedInUrl`,
`contactDataSource`, `contactSourceUrls`, `emailVerificationStatus`, and
`emailVerificationEvidence`. Unavailable details are `null`. Contacts without
an identified source and supporting URLs are cleared. A verified email requires
evidence naming the exact address, actual verifier result, verifier source,
and its supporting URL. Missing or mismatched proof clears the verified claim.
Research claims still require review of the returned sources; shape validation
alone cannot establish their factual accuracy.

`usage.ai.tokens` contains reported AI token usage; `usage.exaAgent` contains
reported Agent usage. `costDollars.exaWebsiteReported` and
`costDollars.exaAgentReported` are separate Exa-reported cost breakdowns.
Unreported usage/costs are `null`; AI dollars are not estimated from token usage.

On polling timeout, HTTP **202** includes the existing `runId`, last observed
Exa `status`, ICP, available accounting, and an empty lead array. The remote run
continues within its budget; no replacement is created. Retrieve it with
`GET /api/leads/{runId}`. Another POST creates a new, billable run.

Upstream failures return HTTP 502, configuration errors HTTP 500, and retrieval
or AI timeouts HTTP 504. Model failures identify the exact required model and
never silently fall back. Every response includes a `requestId`, also returned
in `X-Request-Id`. Server console logs are JSON lines with `requestId`, `step`,
`status`, and `elapsedMs`; they record actual retrieval/generation results and
Agent status polls, without website text, complete contacts, or credentials.

Checks:

```bash
bun test
bun run typecheck
bun run lint
bun run build
```

Tests mock Exa, AI, and Redis; they do not consume API credits.

References used alongside the installed SDK types:

- [AI SDK structured generation](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [Amazon Bedrock provider](https://ai-sdk.dev/providers/ai-sdk-providers/amazon-bedrock)
- [Exa Agent creation](https://exa.ai/docs/reference/agent-api/create-a-run)
- [Exa Agent polling](https://exa.ai/docs/reference/agent-api/get-a-run)
- [Exa Agent list](https://exa.ai/docs/reference/agent-api/list-runs)
- [Upstash Redis TypeScript SDK](https://upstash.com/docs/redis/sdks/ts/getstarted)
- [Fiber provider](https://exa.ai/docs/agent/connect/fiber)
- [Zod JSON Schema](https://zod.dev/json-schema)
