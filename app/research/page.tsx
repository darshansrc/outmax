import { Suspense } from "react";
import type { Metadata } from "next";
import { Header, RunLoading } from "@/components/outmax/shared";
import { Home } from "@/components/outmax/home";

export const metadata: Metadata = { title: "Research" };

export default function Page() {
  return (
    <>
      <Header />
      <Suspense fallback={<main className="mx-auto w-full max-w-4xl px-5 sm:px-8"><RunLoading /></main>}>
        <Home />
      </Suspense>
    </>
  );
}
