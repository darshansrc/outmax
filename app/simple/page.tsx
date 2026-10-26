import type { Metadata } from "next";
import { Suspense } from "react";
import { SimpleChat } from "@/components/outmax/simple-chat";

export const metadata: Metadata = {
  title: "Simple chat",
  description: "Chat with Outmax and follow its web research and tool activity.",
};

export default function SimplePage() {
  return (
    <Suspense fallback={<div role="status" className="flex h-dvh items-center justify-center text-sm text-muted-foreground">Loading chat…</div>}>
      <SimpleChat />
    </Suspense>
  );
}
