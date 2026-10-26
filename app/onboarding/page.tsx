import { Suspense } from "react";
import type { Metadata } from "next";
import { Onboarding } from "@/components/onboarding/setup";
import { Shell } from "@/components/onboarding/shell";

export const metadata: Metadata = { title: "Find customers" };

export default function Page() {
  return (
    <Suspense fallback={<Shell><span className="sr-only">Loading</span></Shell>}>
      <Onboarding />
    </Suspense>
  );
}
