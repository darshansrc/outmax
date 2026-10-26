"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  type DynamicToolUIPart,
  type ToolUIPart,
} from "ai";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Command,
  History,
  LoaderCircle,
  Plus,
  Search,
  Square,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SourceLink } from "@/components/outmax/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import type { ChatHistory, ChatSummary, SavedChat, SimpleChatMessage } from "@/lib/simple-chat";

const suggestions = [
  "Find five promising customers for my product.",
  "Find decision-makers and their work emails at a company.",
  "Validate an email address and check its deliverability.",
];

const toolLabels: Record<string, string> = {
  exa_search: "Web search",
  fiber_search_leads: "Fiber · Lead search",
  fiber_reveal_contact: "Fiber · Work email lookup",
  fiber_find_work_email: "Fiber · Email from name & company",
  fiber_validate_email: "Fiber · Email validation",
  fiber_lookup_email: "Fiber · Person from email",
  fiber_get_credits: "Fiber · Credit balance",
};

function MarkdownLink({ href, children }: { href?: string; children?: ReactNode }) {
  const external = /^https?:\/\//i.test(href ?? "");
  const email = /^mailto:/i.test(href ?? "");
  // GFM turns plain email addresses into mailto links, including inside tables.
  // Keep the text visible even when the link's protocol is unsupported.
  if (!external && !email) return <>{children}</>;

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="text-primary underline-offset-4 hover:underline [overflow-wrap:anywhere]"
    >
      {children}
    </a>
  );
}

function ToolActivity({ part, active }: {
  part: ToolUIPart | DynamicToolUIPart;
  active: boolean;
}) {
  const name = getToolName(part);
  const complete = part.state === "output-available" && !part.preliminary;
  const failed = part.state === "output-error" || part.state === "output-denied";
  const running = !complete && !failed && active;
  const label = complete ? "Completed" : failed ? "Failed" : running ? "Running" : "Stopped";

  return (
    <Collapsible className="overflow-hidden rounded-xl border bg-background">
      <CollapsibleTrigger className="group flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm hover:bg-muted/50">
        {name === "exa_search" ? <Search className="size-4 text-primary" /> : <Wrench className="size-4 text-primary" />}
        <span className="min-w-0 flex-1 truncate font-medium">{toolLabels[name] ?? name}</span>
        <Badge variant={failed ? "destructive" : "secondary"} className="gap-1.5 font-normal">
          {running ? <LoaderCircle className="animate-spin" /> : complete ? <Check /> : failed ? <X /> : <Square />}
          {label}
        </Badge>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-aria-expanded:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 border-t px-4 py-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Input</p>
            <pre className="max-h-48 overflow-auto rounded-lg bg-muted/60 p-3 font-mono text-xs whitespace-pre-wrap break-all">
              {JSON.stringify(part.input, null, 2) ?? "Preparing input…"}
            </pre>
          </div>
          {part.state === "output-available" && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Result</p>
              <pre className="max-h-80 overflow-auto rounded-lg bg-muted/60 p-3 font-mono text-xs whitespace-pre-wrap break-all">
                {JSON.stringify(part.output, null, 2)}
              </pre>
            </div>
          )}
          {part.state === "output-error" && <p role="alert" className="text-sm text-destructive">{part.errorText}</p>}
          {part.state === "output-denied" && <p className="text-sm text-muted-foreground">Tool execution was denied.</p>}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SimpleChat() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("chatId");
  const [session, setSession] = useState<SavedChat | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = useCallback(async (cursor = 0) => {
    await Promise.resolve();
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await fetch(`/api/leads/simple?cursor=${cursor}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Couldn’t load chat history. Please try again.");
      const data: ChatHistory = await response.json();
      setHistory((previous) => cursor === 0 ? data.chats : [...previous, ...data.chats]);
      setNextCursor(data.nextCursor);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Couldn’t load chat history.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadHistory());
  }, [loadHistory]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadChat() {
      await Promise.resolve();
      setLoadError(null);
      if (!selectedId) {
        const now = new Date().toISOString();
        setSession({ chatId: crypto.randomUUID(), title: "New chat", messages: [], messageCount: 0, createdAt: now, updatedAt: now });
        return;
      }
      try {
        const response = await fetch(`/api/leads/simple/${encodeURIComponent(selectedId)}`, {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error(response.status === 404 ? "This chat could not be found." : "Couldn’t load this chat. Please try again.");
        const chat: SavedChat = await response.json();
        if (!controller.signal.aborted) setSession(chat);
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Couldn’t load this chat.");
      }
    }
    void loadChat();
    return () => controller.abort();
  }, [selectedId]);

  const openChat = useCallback((chatId: string) => {
    router.push(`/simple?chatId=${encodeURIComponent(chatId)}`, { scroll: false });
  }, [router]);

  const startedChat = useCallback((chatId: string) => {
    router.replace(`/simple?chatId=${encodeURIComponent(chatId)}`, { scroll: false });
    void loadHistory();
  }, [router, loadHistory]);

  function newChat() {
    const now = new Date().toISOString();
    setSession({ chatId: crypto.randomUUID(), title: "New chat", messages: [], messageCount: 0, createdAt: now, updatedAt: now });
    router.push("/simple", { scroll: false });
  }

  if (loadError) {
    return <div className="flex h-dvh flex-col items-center justify-center gap-4 px-5 text-center">
      <p role="alert" className="text-sm text-destructive">{loadError}</p>
      <Button onClick={newChat}><Plus /> New chat</Button>
      <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
    </div>;
  }

  if (!session || (selectedId && session.chatId !== selectedId)) {
    return <div role="status" className="flex h-dvh items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading chat…</div>;
  }

  return <ChatConversation
    key={session.chatId}
    chat={session}
    history={history}
    historyLoading={historyLoading}
    historyError={historyError}
    nextCursor={nextCursor}
    onLoadHistory={loadHistory}
    onOpenChat={openChat}
    onNewChat={newChat}
    onStarted={startedChat}
  />;
}

function ChatConversation({ chat, history, historyLoading, historyError, nextCursor, onLoadHistory, onOpenChat, onNewChat, onStarted }: {
  chat: SavedChat;
  history: ChatSummary[];
  historyLoading: boolean;
  historyError: string | null;
  nextCursor: number | null;
  onLoadHistory: (cursor?: number) => Promise<void>;
  onOpenChat: (chatId: string) => void;
  onNewChat: () => void;
  onStarted: (chatId: string) => void;
}) {
  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const transport = useMemo(() => new DefaultChatTransport<SimpleChatMessage>({
    api: "/api/leads/simple",
    prepareSendMessagesRequest: ({ id, messages, trigger, messageId }) => ({
      body: { chatId: id, message: messages.at(-1), trigger, messageId },
    }),
    fetch: async (url, options) => {
      const response = await fetch(url, options);
      const chatId = response.headers.get("X-Chat-Id");
      if (response.ok && chatId) onStarted(chatId);
      return response;
    },
  }), [onStarted]);
  const { messages, sendMessage, status, stop, error, regenerate, clearError } =
    useChat<SimpleChatMessage>({
      id: chat.chatId,
      messages: chat.messages,
      transport,
      onFinish: () => { void onLoadHistory(); },
    });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
  }, [messages, status]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    clearError();
    void sendMessage({ text });
    setInput("");
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b bg-background">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <Link href="/research" className="flex items-center gap-2 text-lg font-semibold tracking-tight" aria-label="Outmax home">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Command className="size-5" />
              </span>
              outmax<span className="-ml-2 text-primary">.</span>
            </Link>
            <span className="hidden border-l pl-3 text-sm text-muted-foreground sm:block">Simple chat</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => { setHistoryOpen(true); void onLoadHistory(); }}><History /><span className="hidden sm:inline">History</span></Button>
            <Button variant="outline" onClick={onNewChat} disabled={busy}>
              <Plus /> New chat
            </Button>
          </div>
        </div>
      </header>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Chat history</SheetTitle>
            <SheetDescription>Your saved conversations, most recent first.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
            {history.map((item) => (
              <Button key={item.chatId} variant={item.chatId === chat.chatId ? "secondary" : "ghost"} disabled={busy}
                className="h-auto w-full flex-col items-start gap-1 rounded-xl px-3 py-3 text-left"
                onClick={() => { setHistoryOpen(false); onOpenChat(item.chatId); }}>
                <span className="line-clamp-2 text-sm font-medium whitespace-normal">{item.title}</span>
                <span className="text-xs font-normal text-muted-foreground">{item.messageCount} messages · {new Date(item.updatedAt).toLocaleDateString()}</span>
              </Button>
            ))}
            {historyLoading && <p role="status" className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading history…</p>}
            {!historyLoading && !historyError && history.length === 0 && <p className="p-3 text-sm text-muted-foreground">Your chats will appear here after you send a message.</p>}
            {historyError && <div role="alert" className="space-y-2 p-3 text-sm"><p className="text-destructive">{historyError}</p><Button variant="outline" onClick={() => void onLoadHistory()}>Retry</Button></div>}
            {nextCursor !== null && <Button variant="outline" className="mt-3 w-full" disabled={historyLoading} onClick={() => void onLoadHistory(nextCursor)}>Load more</Button>}
          </div>
        </SheetContent>
      </Sheet>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
          {messages.length === 0 ? (
            <div className="mx-auto flex max-w-lg flex-col items-center py-12 text-center sm:py-20">
              <div className="mb-6 flex size-12 items-center justify-center rounded-2xl border bg-card text-primary">
                <Search className="size-6" />
              </div>
              <Badge variant="outline" className="mb-4 gap-1.5 font-normal"><span className="size-1.5 rounded-full bg-primary" /> Web search & contact research</Badge>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">A little chat. A lot of insight.</h1>
              <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                Ask a question or start researching your next customer. Follow every tool call as it happens.
              </p>
              <div className="mt-8 grid w-full gap-2 text-left">
                {suggestions.map((suggestion) => (
                  <Button key={suggestion} variant="outline" className="h-auto justify-between gap-4 rounded-xl bg-card px-4 py-3 text-left font-normal whitespace-normal" onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}>
                    {suggestion}<ArrowUp className="size-3.5 rotate-45 text-muted-foreground" />
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8" role="log" aria-label="Conversation" aria-live="polite">
              {messages.map((message, messageIndex) => (
                <article key={message.id} className={message.role === "user" ? "ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-primary/8 px-4 py-3" : "space-y-3"}>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">{message.role === "user" ? "You" : "Outmax"}</p>
                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      return message.role === "user" ? (
                        <div key={index} className="text-sm leading-7 whitespace-pre-wrap break-words">{part.text}</div>
                      ) : (
                        <div key={index} className="overflow-x-auto text-sm leading-7 break-words [&_p]:my-2 [&_p:first-child]:mt-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_code]:font-mono [&_code]:text-xs [&_h1]:mt-4 [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-semibold [&_table]:w-full [&_th]:border [&_th]:px-3 [&_th]:text-left [&_td]:border [&_td]:px-3">
                          <Markdown remarkPlugins={[remarkGfm]} components={{ a: MarkdownLink }}>{part.text}</Markdown>
                        </div>
                      );
                    }
                    if (isToolUIPart(part)) {
                      return <ToolActivity key={part.toolCallId} part={part} active={busy && messageIndex === messages.length - 1} />;
                    }
                    if (part.type === "reasoning" && part.text) {
                      return (
                        <Collapsible key={index} className="rounded-xl border px-4 py-3">
                          <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground">
                            <ChevronDown className="size-3.5" /> {part.state === "streaming" && busy ? "Thinking…" : "Reasoning"}
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-3 text-sm leading-6 whitespace-pre-wrap text-muted-foreground">{part.text}</CollapsibleContent>
                        </Collapsible>
                      );
                    }
                    if (part.type === "source-url") {
                      return <div key={part.sourceId}><SourceLink href={part.url}>{part.title ?? part.url}</SourceLink></div>;
                    }
                    return null;
                  })}
                  {message.metadata?.totalTokens != null && (
                    <p className="pt-1 text-xs text-muted-foreground">{message.metadata.totalTokens.toLocaleString()} tokens used</p>
                  )}
                </article>
              ))}
            </div>
          )}

          {busy && (
            <div role="status" className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              {status === "submitted" ? "Connecting…" : "Working…"}
            </div>
          )}
          {error && (
            <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
              <p className="text-destructive">Couldn&apos;t complete the response. Please try again.</p>
              <Button variant="outline" onClick={() => void regenerate()} disabled={busy}>Retry</Button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="shrink-0 bg-background px-5 pb-4 pt-3 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <form onSubmit={submit} className="rounded-2xl border bg-card p-3 shadow-sm focus-within:ring-2 focus-within:ring-primary/15">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              aria-label="Message"
              placeholder="Ask anything, or share a product to research…"
              maxLength={8_000}
              disabled={busy}
              className="max-h-40 min-h-16 resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Search className="size-3.5" /> Web & contact research</span>
              {busy ? (
                <Button type="button" size="icon" onClick={() => void stop()} aria-label="Stop response"><Square className="size-3.5 fill-current" /></Button>
              ) : (
                <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Send message"><ArrowUp /></Button>
              )}
            </div>
          </form>
          <p className="mt-2.5 text-center text-[11px] text-muted-foreground">Enter to send · Shift + Enter for a new line</p>
        </div>
      </footer>
    </div>
  );
}
