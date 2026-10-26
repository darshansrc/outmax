import type { Metadata } from "next";
import { Landing } from "@/components/landing/landing";

export const metadata: Metadata = {
  title: "Find companies ready to buy from you this week",
  description: "Paste your website and get companies that are hiring, growing or spending on what you sell, plus the decision-maker and a verified email at each. Your first 20 leads are free.",
  openGraph: {
    title: "Outmax · Find companies ready to buy from you this week",
    description: "Leads with a reason to buy, the decision-maker at each, and a verified email. First 20 free.",
    type: "website",
  },
};

export default function Page() {
  return <Landing />;
}
