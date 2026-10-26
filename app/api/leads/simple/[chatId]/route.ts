import { z } from "zod";
import { ChatStore, ChatStoreError } from "@/lib/chat-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const { chatId } = await params;
  if (!z.uuid().safeParse(chatId).success) {
    return Response.json({ error: "Invalid chat ID." }, { status: 400 });
  }
  try {
    const chat = await new ChatStore().get(chatId);
    return Response.json(chat ?? { error: "Chat not found." }, {
      status: chat ? 200 : 404,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json({
      error: error instanceof ChatStoreError ? error.message : "Unable to load this chat.",
    }, { status: error instanceof ChatStoreError ? error.status : 500 });
  }
}
