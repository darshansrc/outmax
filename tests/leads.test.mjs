import { afterAll, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { ExaError } from "exa-js";
import { cleanLeads, extractWebsite } from "../lib/leads.ts";

const icp = {
  productSummary: "Support automation for Shopify stores.",
  industries: ["Ecommerce"], companySize: null, geography: ["US"],
  buyerRoles: ["Head of Ecommerce"], qualificationCriteria: ["Uses Shopify", "US based"],
  explicitUserInstructions: ["Focus on US Shopify stores."],
};
const lead = {
  companyName: "Example Store", website: "https://store.example.com",
  location: "US", fitExplanation: "A US Shopify store.",
  sourceUrls: ["https://store.example.com/about"],
  contactName: "Test Person", jobTitle: "Head of Ecommerce",
  workEmail: "person@store.example.com", linkedInUrl: "https://linkedin.com/in/test-person",
  contactDataSource: "Fiber", contactSourceUrls: ["https://linkedin.com/in/test-person"],
  emailVerificationStatus: "verified", emailVerificationEvidence: null,
};
const completed = {
  id: "agent_run_test", status: "completed", stopReason: "budget_reached",
  output: { structured: { leads: [lead], shortfallReason: "Budget exhausted." } },
  usage: { searches: 3, dataSources: { fiber: 1 } },
  costDollars: { total: 4.8, dataSources: { fiber: 0.5 } },
};
const gateway = mock((model) => ({ modelId: model }));
const generateText = mock(async () => ({
  output: icp, totalUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
  finishReason: "stop",
}));
const create = mock(async () => ({ id: "agent_run_test", status: "queued" }));
const get = mock(async () => completed);
const getAll = mock(async () => [completed]);
const getContents = mock(async () => ({
  results: [{ text: "Website content fixture." }], costDollars: { total: 0.001 },
}));
const stored = new Map();
const redisGet = mock(async (key) => stored.get(key) ?? null);
const redisSet = mock(async (key, value) => {
  stored.set(key, JSON.parse(JSON.stringify(value)));
  return "OK";
});
const redisMget = mock(async (...keys) => keys.map((key) => stored.get(key) ?? null));
const redisPing = mock(async () => "PONG");
mock.module("@upstash/redis", () => ({
  Redis: {
    fromEnv: () => ({
      get: redisGet, set: redisSet, mget: redisMget, ping: redisPing,
    }),
  },
}));
const logs = [];
const logSpy = spyOn(console, "log").mockImplementation((line) => logs.push(line));
const errorSpy = spyOn(console, "error").mockImplementation((line) => logs.push(line));
mock.module("ai", () => ({
  gateway, generateText, Output: { object: (options) => options },
}));
mock.module("exa-js", () => ({
  default: class {
    getContents = getContents;
    agent = { runs: { create, get, getAll } };
  },
  ExaError,
}));
const { POST, GET: listRuns } = await import("../app/api/leads/route.ts");
const { GET: getRun } = await import("../app/api/leads/[runId]/route.ts");
const envNames = [
  "EXA_API_KEY", "AI_GATEWAY_API_KEY", "EXA_RUN_BUDGET_DOLLARS",
  "EXA_POLL_TIMEOUT_MS", "EXA_POLL_INTERVAL_MS",
  "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "LEADS_REDIS_TTL_SECONDS",
];
const savedEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));

beforeEach(() => {
  for (const name of envNames) delete process.env[name];
  process.env.EXA_API_KEY = "exa-test-credential";
  process.env.AI_GATEWAY_API_KEY = "gateway-test-credential";
  process.env.EXA_POLL_INTERVAL_MS = "1";
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
  process.env.UPSTASH_REDIS_REST_TOKEN = "redis-test-credential";
  for (const fn of [
    gateway, generateText, create, get, getAll, getContents,
    redisGet, redisSet, redisMget, redisPing,
  ]) fn.mockClear();
  stored.clear();
  logs.length = 0;
});
afterAll(() => {
  for (const name of envNames) {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  }
  logSpy.mockRestore();
  errorSpy.mockRestore();
});
function request(body = { prompt: "Find customers for https://elkagent.com. Focus on US Shopify stores." }) {
  return new Request("http://localhost/api/leads", {
    method: "POST", body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

test("rejects malformed requests before calling paid services", async () => {
  const inputs = [
    request({}), request({ prompt: "" }), request({ prompt: "No website" }),
    request({ prompt: "https://elkagent.com and https://other.example.com" }),
    request({ prompt: "https://user:pass@elkagent.com" }),
    new Request("http://localhost/api/leads", { method: "POST", body: "{" }),
  ];
  for (const input of inputs) expect((await POST(input)).status).toBe(400);
  expect(getContents).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
  expect(extractWebsite("Find customers for (https://elkagent.com).")).toBe("https://elkagent.com/");
  expect(extractWebsite("http://localhost:3000")).toBeNull();
});

test("creates one Fiber run with budget, validates, deduplicates, and separates accounting", async () => {
  get.mockImplementationOnce(async () => ({
    ...completed,
    output: { structured: {
      leads: [lead, { ...lead, companyName: "Alternate name", website: "https://www.store.example.com/" }],
      shortfallReason: "Budget exhausted.",
    } },
  }));
  const response = await POST(request());
  const data = await response.json();
  expect(response.status).toBe(200);
  expect(data.returnedCount).toBe(data.leads.length);
  expect(data.returnedCount).toBe(1);
  expect(data.shortfallReason).toContain("duplicate");
  expect(data.icp.geography).toEqual(["US"]);
  expect(data.leads[0].emailVerificationStatus).toBeNull();
  expect(data.usage.ai.tokens.totalTokens).toBe(150);
  expect(data.usage.exaAgent).toEqual(completed.usage);
  expect(data.costDollars.exaAgentReported.total).toBe(4.8);
  expect(data.costDollars.exaWebsiteReported.total).toBe(0.001);
  expect(gateway).toHaveBeenCalledWith("openai/gpt-6.1-sol");
  expect(generateText.mock.calls[0][0].output.schema).toBeDefined();
  expect(create).toHaveBeenCalledTimes(1);
  const options = create.mock.calls[0][0];
  expect(options.effort).toBe("auto");
  expect(options.budget).toEqual({ maxCostDollars: 5 });
  expect(options.dataSources).toEqual([{ provider: "fiber" }]);
  expect(options.outputSchema.properties.leads.maxItems).toBe(20);
  expect(options.query).toContain("Focus on US Shopify stores.");
  const context = stored.get("outmax:leads:context:agent_run_test");
  expect(context.icp).toEqual(icp);
  expect(context.aiUsage.totalTokens).toBe(150);
  expect(stored.get("outmax:leads:run:agent_run_test").status).toBe("completed");
  expect(redisSet.mock.calls.every(([, , options]) => options.ex === 86_400)).toBe(true);
  for (const line of logs) {
    const entry = JSON.parse(line);
    expect(entry.requestId).toBe(data.requestId);
    expect(entry.step).toBeString();
    expect(entry.status).toBeString();
    expect(entry.elapsedMs).toBeNumber();
  }
  expect(logs.join("")).not.toContain(lead.workEmail);
  expect(logs.join("")).not.toContain("Website content fixture.");
  expect(logs.join("")).not.toContain("test-credential");
});

test("returns 202 with last observed status if a poll hangs, without a replacement", async () => {
  process.env.EXA_POLL_TIMEOUT_MS = "15";
  get.mockImplementationOnce(async () => ({ id: "agent_run_test", status: "running" }));
  get.mockImplementationOnce(() => new Promise(() => {}));
  const response = await POST(request());
  const data = await response.json();
  expect(response.status).toBe(202);
  expect(data.runId).toBe("agent_run_test");
  expect(data.status).toBe("running");
  expect(data.returnedCount).toBe(0);
  expect(create).toHaveBeenCalledTimes(1);
  expect(logs.some((line) => JSON.parse(line).status === "timeout")).toBe(true);
});

test("honors configured budgets and rejects invalid settings before retrieval", async () => {
  process.env.EXA_RUN_BUDGET_DOLLARS = "2.5";
  expect((await POST(request())).status).toBe(200);
  expect(create.mock.calls[0][0].budget.maxCostDollars).toBe(2.5);
  getContents.mockClear();
  process.env.EXA_POLL_TIMEOUT_MS = "NaN";
  expect((await POST(request())).status).toBe(500);
  expect(getContents).not.toHaveBeenCalled();
});

test("reports exact-model unavailability without fallback or upstream content", async () => {
  const error = new Error("upstream-private-content");
  error.name = "GatewayModelNotFoundError";
  generateText.mockRejectedValueOnce(error);
  const response = await POST(request());
  const data = await response.json();
  expect(response.status).toBe(502);
  expect(data.error).toContain("openai/gpt-6.1-sol is unavailable");
  expect(data.error).toContain("no fallback");
  expect(create).not.toHaveBeenCalled();
  expect(gateway).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(data) + logs.join("")).not.toContain("upstream-private-content");
});

test("rejects unusable website content, failed runs, and malformed output", async () => {
  getContents.mockResolvedValueOnce({ results: [], costDollars: { total: 0.001 } });
  expect((await POST(request())).status).toBe(502);
  expect(generateText).not.toHaveBeenCalled();
  get.mockResolvedValueOnce({ id: "agent_run_test", status: "failed", stopReason: "error" });
  const failed = await (await POST(request())).json();
  expect(failed.runId).toBe("agent_run_test");
  expect(failed.step).toBe("exa_completion");
  get.mockResolvedValueOnce({ ...completed, output: { structured: { leads: "bad" } } });
  const invalid = await POST(request());
  expect(invalid.status).toBe(502);
  expect((await invalid.json()).step).toBe("output_validation");
});

test("removes unsupported companies/contacts and requires proof matching the email", () => {
  const proof = {
    email: lead.workEmail, source: "Verifier", result: "deliverable",
    sourceUrl: "https://verifier.example.com/results/test",
  };
  const checked = cleanLeads([
    { ...lead, sourceUrls: null },
    { ...lead, contactSourceUrls: null },
    { ...lead, companyName: "Second", website: null, emailVerificationEvidence: {
      ...proof, email: "other@store.example.com",
    } },
    { ...lead, companyName: "Third", website: null, emailVerificationEvidence: proof },
  ]);
  expect(checked.unsupportedRemoved).toBe(1);
  expect(checked.leads[0].contactName).toBeNull();
  expect(checked.leads[0].workEmail).toBeNull();
  expect(checked.leads[1].emailVerificationStatus).toBeNull();
  expect(checked.leads[2].emailVerificationStatus).toBe("verified");
});

function readRun(runId = "agent_run_test") {
  return getRun(new Request(`http://localhost/api/leads/${runId}`), {
    params: Promise.resolve({ runId }),
  });
}

test("lists all existing Exa runs, even when Redis has no record of older runs", async () => {
  getAll.mockResolvedValueOnce([
    completed, { id: "agent_run_old", status: "running", createdAt: "2026-10-08T18:00:00Z" },
  ]);
  const response = await listRuns();
  const data = await response.json();
  expect(response.status).toBe(200);
  expect(data.runCount).toBe(2);
  expect(data.runs[0].runId).toBe(completed.id);
  expect(data.runs[0].returnedCount).toBe(1);
  expect(data.runs[0].resultsAvailable).toBe(true);
  expect(data.runs[0].usage.ai.tokens).toBeNull();
  expect(data.runs[1].status).toBe("running");
  expect(data.runs[0]).not.toHaveProperty("leads");
  expect(getAll).toHaveBeenCalledWith({ limit: 100 });
  expect(create).not.toHaveBeenCalled();
  expect(generateText).not.toHaveBeenCalled();
});

test("refreshes pending runs, validates results, then reads terminal results from Redis", async () => {
  get.mockResolvedValueOnce({ ...completed, status: "running", output: null, stopReason: null });
  const pending = await readRun();
  expect(pending.status).toBe(202);
  expect((await pending.json()).status).toBe("running");
  expect(stored.get("outmax:leads:run:agent_run_test").status).toBe("running");
  const response = await readRun();
  const data = await response.json();
  expect(response.status).toBe(200);
  expect(data.source).toBe("exa");
  expect(data.returnedCount).toBe(data.leads.length);
  expect(data.leads[0].emailVerificationStatus).toBeNull();
  expect(data.icp).toBeNull();
  expect(data.usage.ai.tokens).toBeNull();
  expect(data.costDollars.exaWebsiteReported).toBeNull();
  const cached = await (await readRun()).json();
  expect(cached.source).toBe("redis");
  expect(cached.leads).toEqual(data.leads);
  expect(get).toHaveBeenCalledTimes(2);
  expect(create).not.toHaveBeenCalled();
});

test("retains the POST ICP and accounting for later reads without needing an AI key", async () => {
  process.env.LEADS_REDIS_TTL_SECONDS = "3600";
  await POST(request());
  delete process.env.AI_GATEWAY_API_KEY;
  const response = await readRun();
  const data = await response.json();
  expect(response.status).toBe(200);
  expect(data.icp).toEqual(icp);
  expect(data.usage.ai.tokens.totalTokens).toBe(150);
  expect(data.costDollars.exaWebsiteReported.total).toBe(0.001);
  expect(data.costDollars.exaAgentReported.total).toBe(4.8);
  expect(redisSet.mock.calls.every(([, , options]) => options.ex === 3600)).toBe(true);
  expect(create).toHaveBeenCalledTimes(1);
  expect(generateText).toHaveBeenCalledTimes(1);
});

test("returns empty lists, validation failures, failed runs, and missing IDs clearly", async () => {
  getAll.mockResolvedValueOnce([]);
  const empty = await (await listRuns()).json();
  expect(empty.runs).toEqual([]);
  expect(empty.runCount).toBe(0);
  expect((await readRun("../invalid")).status).toBe(400);
  expect(get).not.toHaveBeenCalled();
  get.mockRejectedValueOnce(new ExaError("upstream-private-content", 404));
  const missing = await readRun();
  expect(missing.status).toBe(404);
  expect((await missing.json()).error).toBe("Run not found.");
  get.mockResolvedValueOnce({ ...completed, status: "failed", stopReason: "error" });
  const failed = await readRun();
  expect(failed.status).toBe(502);
  expect((await failed.json()).status).toBe("failed");
  stored.clear();
  get.mockResolvedValueOnce({ ...completed, output: { structured: { leads: "bad" } } });
  const invalid = await readRun();
  expect(invalid.status).toBe(502);
  expect((await invalid.json()).step).toBe("output_validation");
  expect(logs.join("")).not.toContain("upstream-private-content");
});

test("fails before paid calls when Redis is missing or unavailable, retaining IDs on later failures", async () => {
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  expect((await POST(request())).status).toBe(500);
  expect(create).not.toHaveBeenCalled();
  expect(getContents).not.toHaveBeenCalled();
  process.env.UPSTASH_REDIS_REST_TOKEN = "redis-test-credential";
  redisPing.mockRejectedValueOnce(new Error("private-redis-details"));
  expect((await POST(request())).status).toBe(503);
  expect(getContents).not.toHaveBeenCalled();
  redisSet.mockRejectedValueOnce(new Error("private-redis-details"));
  const failedSave = await POST(request());
  const data = await failedSave.json();
  expect(failedSave.status).toBe(503);
  expect(data.runId).toBe("agent_run_test");
  expect(create).toHaveBeenCalledTimes(1);
  redisGet.mockRejectedValueOnce(new Error("private-redis-details"));
  expect((await readRun()).status).toBe(503);
  expect(logs.join("")).not.toContain("private-redis-details");
});
