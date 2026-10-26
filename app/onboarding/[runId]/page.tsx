import { Suspense } from "react";
import type { Metadata } from "next";
import { RunPage } from "@/components/onboarding/run-view";
import { Shell } from "@/components/onboarding/shell";

export const metadata: Metadata = { title: "Leads" };

export default function Page() {
  return (
    <Suspense fallback={<Shell><span className="sr-only">Loading</span></Shell>}>
      <RunPage />
    </Suspense>
  );
}
