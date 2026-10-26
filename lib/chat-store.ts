import { Redis } from "@upstash/redis";
import { normalizeChatMessageIds } from "./simple-chat";
import type { ChatHistory, SavedChat, SimpleChatMessage } from "./simple-chat";

export const CHAT_INDEX_KEY = "outmax:chat:index";
export const chatKey = (chatId: string) => `outmax:chat:${chatId}`;

export class ChatStoreError extends Error {
  constructor(message: string, readonly status = 503) {
    super(message);
  }
}

export class ChatStore {
  private readonly redis: Redis;

  constructor() {
    if (!process.env.UPSTASH_REDIS_REST_URL?.trim() || !process.env.UPSTASH_REDIS_REST_TOKEN?.trim()) {
      throw new ChatStoreError("Redis chat storage is not configured.");
    }
    this.redis = Redis.fromEnv({
      signal: () => AbortSignal.timeout(10_000),
      retry: false,
      enableTelemetry: false,
    });
  }

  private async execute<T>(operation: Promise<T>): Promise<T> {
    try {
      return await operation;
    } catch {
      throw new ChatStoreError("Redis chat storage is unavailable. Please try again.");
    }
  }

  async get(chatId: string): Promise<SavedChat | null> {
    const chat = await this.execute(this.redis.get<SavedChat>(chatKey(chatId)));
    return chat ? { ...chat, messages: normalizeChatMessageIds(chatId, chat.messages) } : null;
  }

  async list(cursor = 0): Promise<ChatHistory> {
    const pageSize = 50;
    const ids = await this.execute(this.redis.zrange<string[]>(
      CHAT_INDEX_KEY, cursor, cursor + pageSize, { rev: true },
    ));
    const pageIds = ids.slice(0, pageSize);
    const records = pageIds.length
      ? await this.execute(this.redis.mget<(SavedChat | null)[]>(...pageIds.map(chatKey)))
      : [];
    return {
      chats: records.filter((chat): chat is SavedChat => chat !== null)
        .map(({ chatId, title, createdAt, updatedAt, messageCount }) => ({
          chatId, title, createdAt, updatedAt, messageCount,
        })),
      nextCursor: ids.length > pageSize ? cursor + pageSize : null,
    };
  }

  async save(chatId: string, inputMessages: SimpleChatMessage[], existing: SavedChat | null): Promise<SavedChat> {
    const messages = normalizeChatMessageIds(chatId, inputMessages);
    const now = new Date().toISOString();
    const firstPrompt = messages.find((message) => message.role === "user")
      ?.parts.filter((part) => part.type === "text").map((part) => part.text).join(" ");
    const chat: SavedChat = {
      chatId,
      title: firstPrompt?.replace(/\s+/g, " ").trim().slice(0, 100) || "New chat",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      messageCount: messages.length,
      messages,
    };
    // MULTI keeps the transcript and history index in sync. Neither key expires.
    await this.execute(this.redis.multi()
      .set(chatKey(chatId), chat)
      .zadd(CHAT_INDEX_KEY, { score: Date.parse(now), member: chatId })
      .exec());
    return chat;
  }
}
