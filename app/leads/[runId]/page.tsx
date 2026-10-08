import type { Metadata } from "next";
import { Header } from "@/components/outmax/shared";
import { RunDetail } from "@/components/outmax/run-detail";

export const metadata: Metadata = { title: "Lead research" };

export default async function Page({ params }: PageProps<"/leads/[runId]">) {
  const { runId } = await params;
  return <><Header /><RunDetail key={runId} runId={runId} /></>;
}
