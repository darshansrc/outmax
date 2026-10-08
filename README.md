# Outmax

`POST /api/leads` retrieves a product website with Exa, generates an ICP with
`generateText` + `Output.object` using **only** `gateway("openai/gpt-6.1-sol")`,
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
- [AI Gateway](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway)
- [Exa Agent creation](https://exa.ai/docs/reference/agent-api/create-a-run)
- [Exa Agent polling](https://exa.ai/docs/reference/agent-api/get-a-run)
- [Exa Agent list](https://exa.ai/docs/reference/agent-api/list-runs)
- [Upstash Redis TypeScript SDK](https://upstash.com/docs/redis/sdks/ts/getstarted)
- [Fiber provider](https://exa.ai/docs/agent/connect/fiber)
- [Zod JSON Schema](https://zod.dev/json-schema)
