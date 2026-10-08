# Outmax backend test

`POST /api/leads` retrieves a product website with Exa, generates an ICP with
`generateText` + `Output.object` using **only** `gateway("openai/gpt-6.1-sol")`,
and creates one Exa Agent run with Fiber enabled to find up to 20 companies and
their decision-makers. Explicit instructions in the prompt override inferred
preferences. No UI, database, authentication, or outreach is added.

Use Node.js 22 or newer and Bun (the repo's package manager):

```bash
bun install
bun dev
```

The existing `.env` must contain `EXA_API_KEY` and `AI_GATEWAY_API_KEY`. Next.js
loads them server-side. Keep their existing values; do not put them in the curl
request or use a `NEXT_PUBLIC_` prefix. This repo enables Cache Components, which
disallows a route-level `runtime` export; the route runs on the default Node.js
runtime and imports `node:crypto`.

Example request:

```bash
curl -i --max-time 240 http://localhost:3000/api/leads \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Find customers for https://elkagent.com. Focus on US Shopify stores."}'
```

Include exactly one public HTTP(S) product website URL. Ambiguous/missing URLs,
embedded URL credentials, malformed JSON, and empty prompts return HTTP 400.

Optional server environment variables (leave unset to use defaults):

- `EXA_RUN_BUDGET_DOLLARS`: positive dollar amount; default **5**. Sent as
  `budget.maxCostDollars` with `effort: "auto"`. This ceiling applies to the
  Agent run; website retrieval and the separate AI call have their own usage.
- `EXA_POLL_TIMEOUT_MS`: positive integer; default **120000**. Starts after run
  creation. This controls the local wait, not the lifetime of the remote run.
- `EXA_POLL_INTERVAL_MS`: positive integer; default **2000**.

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
continues within its budget; no replacement is created. Inspect that same run
with `exa.agent.runs.get(runId)` or the Exa dashboard. Another POST creates a new,
billable run. This minimal route does not add a resume endpoint.

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

Tests mock paid services; they do not consume API credits.

References used alongside the installed SDK types:

- [AI SDK structured generation](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [AI Gateway](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway)
- [Exa Agent creation](https://exa.ai/docs/reference/agent-api/create-a-run)
- [Exa Agent polling](https://exa.ai/docs/reference/agent-api/get-a-run)
- [Fiber provider](https://exa.ai/docs/agent/connect/fiber)
- [Zod JSON Schema](https://zod.dev/json-schema)
