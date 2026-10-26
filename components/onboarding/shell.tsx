import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";
import { Emblem } from "@/components/brand/logo";

export function Shell({ crumb, status, actions, aside, children }: {
  crumb?: ReactNode; status?: ReactNode; actions?: ReactNode; aside?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-white font-sans text-zinc-950 antialiased lg:h-dvh lg:overflow-hidden">
      <header className="sticky top-0 z-40 shrink-0 border-b border-zinc-200 bg-white/90 backdrop-blur-md lg:static lg:bg-white">
        <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-5">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2.5 text-[13px]">
            <Link href="/" aria-label="Outmax home" className="shrink-0"><Emblem className="size-5 text-zinc-950" /></Link>
            <Link href="/onboarding" className={cn("transition-colors hover:text-zinc-950", crumb ? "text-zinc-400" : "font-medium text-zinc-950")}>Searches</Link>
            {crumb && <>
              <span aria-hidden className="text-zinc-300">/</span>
              <span className="truncate font-medium text-zinc-950">{crumb}</span>
            </>}
          </nav>
          <div className="flex shrink-0 items-center gap-2">{status}{actions}</div>
        </div>
      </header>
      {aside ? (
        <div className="grid flex-1 lg:min-h-0 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="order-last border-t border-zinc-200 bg-[#fcfcfc] p-5 lg:order-none lg:overflow-y-auto lg:overscroll-contain lg:border-t-0 lg:border-r">
            {aside}
          </aside>
          <main className="min-w-0 lg:overflow-y-auto lg:overscroll-contain">{children}</main>
        </div>
      ) : (
        <main className="flex-1 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">{children}</main>
      )}
    </div>
  );
}

export function PanelLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[11px] font-medium text-zinc-500", className)}>{children}</p>;
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-7 shrink-0 items-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 text-[12px] font-medium text-zinc-700 tabular-nums">
      {children}
    </span>
  );
}

export function Spinner({ className = "size-3" }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block shrink-0 animate-spin rounded-full border-[1.5px] border-zinc-300 border-t-zinc-900", className)} />;
}

export function Dot({ tone }: { tone: "green" | "red" | "zinc" }) {
  return <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", tone === "green" ? "bg-emerald-500" : tone === "red" ? "bg-red-500" : "bg-zinc-300")} />;
}

export function hostname(site: string) {
  try {
    return new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`).hostname.replace(/^www\./, "");
  } catch {
    return site;
  }
}

export function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
