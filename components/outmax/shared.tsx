import Link from "next/link";
import { ArrowUpRight, Command, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { RunSummary } from "@/lib/lead-types";

export function Header() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-xl font-semibold tracking-tight" aria-label="Outmax home">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Command className="size-5" strokeWidth={2.4} />
          </span>
          outmax<span className="-ml-2 text-primary">.</span>
        </Link>
        <span className="text-xs text-muted-foreground">Your next customer, found.</span>
      </div>
    </header>
  );
}

export function StatusBadge({ status }: { status: RunSummary["status"] }) {
  const active = status === "running" || status === "queued";
  return (
    <Badge variant="secondary" className={`h-6 gap-1.5 px-2.5 font-normal ${
      status === "completed" ? "bg-emerald-50 text-emerald-800"
        : active ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-800"
    }`}>
      {active ? <LoaderCircle className="animate-spin" /> : <span className="size-1.5 rounded-full bg-current" />}
      {status === "completed" ? "Completed" : status === "running" ? "In progress"
        : status === "queued" ? "Queued" : status === "cancelled" ? "Cancelled" : "Failed"}
    </Badge>
  );
}

export function domain(url: string | null) {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

export function formatDate(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return "Date unavailable";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function formatCost(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", {
      style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4,
    }).format(value)
    : "Not reported";
}

export function SourceLink({ href, children }: { href: string; children?: React.ReactNode }) {
  // Sources come from research; only open HTTP(S) URLs.
  if (!/^https?:\/\//i.test(href)) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
      <span className="truncate">{children ?? domain(href) ?? "Source"}</span>
      <ArrowUpRight className="size-3.5 shrink-0" />
    </a>
  );
}

export function RunLoading() {
  return (
    <div className="space-y-5 py-6" role="status" aria-label="Loading research">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}
