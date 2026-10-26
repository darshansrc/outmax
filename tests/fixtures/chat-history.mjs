import { afterAll, beforeEach, expect, mock, test } from "bun:test";

const ai = await import("ai");
const records = new Map();
const index = new Map();
const writes = [];
const redisGet = mock(async (key) => records.get(key) ?? null);
const redisMget = mock(async (...keys) => keys.map((key) => records.get(key) ?? null));
const redisZrange = mock(async (_key, start, end) =>
  [...index].sort((a, b) => b[1] - a[1]).slice(start, end + 1).map(([id]) => id));
const redisMulti = mock(() => {
  const commands = [];
  const transaction = {
    set(...args) { commands.push(["set", args]); return transaction; },
    zadd(...args) { commands.push(["zadd", args]); return transaction; },
    async exec() {
      for (const [command, args] of commands) {
        writes.push([command, args]);
        if (command === "set") records.set(args[0], structuredClone(args[1]));
        else index.set(args[1].member, args[1].score);
      }
      return ["OK", 1];
    },
  };
  return transaction;
});
mock.module("@upstash/redis", () => ({
  Redis: { fromEnv: () => ({
    get: redisGet, mget: redisMget, zrange: redisZrange, multi: redisMulti,
  }) },
}));

const streamText = mock(() => ({
  toUIMessageStreamResponse(options) {
    const stream = ai.createUIMessageStream({
      originalMessages: options.originalMessages,
      onEnd: options.onEnd,
      execute({ writer }) {
        writer.write({ type: "start", messageId: ai.generateId() });
        writer.write({
          type: "tool-input-available", toolCallId: "search-1", toolName: "exa_search",
          input: { query: "test research" }, providerExecuted: true,
        });
        writer.write({
          type: "tool-output-available", toolCallId: "search-1",
          output: { requestId: "test-search", results: [{ id: "https://example.com", title: "Saved source", url: "https://example.com" }] },
          providerExecuted: true,
        });
        writer.write({ type: "text-start", id: "text-1" });
        writer.write({ type: "text-delta", id: "text-1", delta: "Saved response." });
        writer.write({ type: "text-end", id: "text-1" });
        writer.write({ type: "finish", messageMetadata: { totalTokens: 42 } });
      },
    });
    return ai.createUIMessageStreamResponse({ ...options, stream });
  },
}));
mock.module("ai", () => ({ ...ai, streamText }));

const { GET, POST } = await import("../../app/api/leads/simple/route.ts");
const { GET: getChat } = await import("../../app/api/leads/simple/[chatId]/route.ts");
const { ChatStore, CHAT_INDEX_KEY, chatKey } = await import("../../lib/chat-store.ts");
const chatId = "c1dd4f69-01a8-4fa1-965a-11b85fd4a0b8";
const envNames = ["BEDROCK_API_KEY", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"];
const savedEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));

beforeEach(() => {
  for (const name of envNames) process.env[name] = "test";
  records.clear();
  index.clear();
  writes.length = 0;
  for (const fn of [redisGet, redisMget, redisZrange, redisMulti, streamText]) fn.mockClear();
});
afterAll(() => {
  for (const name of envNames) {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  }
});

function request(body) {
  return new Request("http://localhost/api/leads/simple", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const userMessage = (id, text) => ({ id, role: "user", parts: [{ type: "text", text }] });
async function send(message, extra = {}) {
  const response = await POST(request({ chatId, message, trigger: "submit-message", ...extra }));
  await response.text();
  return response;
}

test("persists stable chat IDs, tool results and metadata without expiry", async () => {
  const response = await send(userMessage("user-1", "Research example companies"));
  expect(response.status).toBe(200);
  expect(response.headers.get("X-Chat-Id")).toBe(chatId);
  const saved = records.get(chatKey(chatId));
  expect(saved.messages).toHaveLength(2);
  expect(saved.messages[1].parts.find((part) => part.type === "tool-exa_search").output.results[0].title).toBe("Saved source");
  expect(saved.messages[1].metadata.totalTokens).toBe(42);
  expect(index.has(chatId)).toBe(true);
  for (const [command, args] of writes) {
    expect(args).toHaveLength(2); // No expiration options on either Redis command.
    if (command === "zadd") expect(args[0]).toBe(CHAT_INDEX_KEY);
  }
  const loaded = await getChat(new Request("http://localhost"), { params: Promise.resolve({ chatId }) });
  expect((await loaded.json()).messages).toEqual(saved.messages);
});

test("loads earlier conversation from Redis when only the new message is sent", async () => {
  await send(userMessage("user-1", "Remember emerald"));
  const createdAt = records.get(chatKey(chatId)).createdAt;
  await send(userMessage("user-2", "What did I ask you to remember?"));
  const options = streamText.mock.calls[1][0];
  expect(options.messages[0].content[0].text).toBe("Remember emerald");
  expect(records.get(chatKey(chatId)).messages).toHaveLength(4);
  expect(records.get(chatKey(chatId)).createdAt).toBe(createdAt);
});

test("regeneration replaces the previous response without duplicating the user message", async () => {
  await send(userMessage("user-1", "Hello"));
  const previousId = records.get(chatKey(chatId)).messages[1].id;
  await send(undefined, { trigger: "regenerate-message", messageId: previousId });
  expect(records.get(chatKey(chatId)).messages).toHaveLength(2);
  expect(records.get(chatKey(chatId)).messages[0].id).toBe("user-1");
  expect(records.get(chatKey(chatId)).messages[1].id).not.toBe(previousId);
});

test("history returns summaries and paginates without dropping older chats", async () => {
  const store = new ChatStore();
  for (let n = 0; n < 51; n++) {
    const id = `chat-${n}`;
    const chat = await store.save(id, [userMessage(`user-${n}`, `Chat ${n}`)], null);
    index.set(id, n); // Deterministic sort order for this fixture.
    expect(chat.messageCount).toBe(1);
  }
  const first = await (await GET(new Request("http://localhost/api/leads/simple"))).json();
  expect(first.chats).toHaveLength(50);
  expect(first.chats[0].title).toBe("Chat 50");
  expect(first.chats[0].messages).toBeUndefined();
  expect(first.nextCursor).toBe(50);
  const second = await store.list(first.nextCursor);
  expect(second.chats).toHaveLength(1);
  expect(second.nextCursor).toBeNull();
});

test("rejects invalid IDs and reports Redis failures before starting AI generation", async () => {
  expect((await POST(request({ chatId: "invalid", prompt: "Hello" }))).status).toBe(400);
  const missing = await getChat(new Request("http://localhost"), { params: Promise.resolve({ chatId }) });
  expect(missing.status).toBe(404);
  redisGet.mockImplementationOnce(async () => { throw new Error("Connection failed"); });
  expect((await POST(request({ chatId, prompt: "Hello" }))).status).toBe(503);
  expect(streamText).not.toHaveBeenCalled();
});
