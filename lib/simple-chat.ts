import type { UIMessage } from "ai";

export type SimpleChatMessage = UIMessage<{ totalTokens?: number }>;

export type ChatSummary = {
  chatId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

export type SavedChat = ChatSummary & { messages: SimpleChatMessage[] };
export type ChatHistory = { chats: ChatSummary[]; nextCursor: number | null };

export function normalizeChatMessageIds(chatId: string, messages: SimpleChatMessage[]): SimpleChatMessage[] {
  const reserved = new Set(messages.map((message) => message.id)
    .filter((id) => typeof id === "string" && id.trim().length > 0));
  const used = new Set<string>();

  return messages.map((message, index) => {
    if (typeof message.id === "string" && message.id.trim() && !used.has(message.id)) {
      used.add(message.id);
      return message;
    }

    // Stable across reads of legacy chats until the repaired IDs are saved.
    const base = `${chatId}:message:${index}`;
    let id = base;
    for (let suffix = 1; reserved.has(id) || used.has(id); suffix++) {
      id = `${base}:${suffix}`;
    }
    used.add(id);
    return { ...message, id };
  });
}
