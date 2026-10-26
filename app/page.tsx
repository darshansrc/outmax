import type { Metadata } from "next";
import { Landing } from "@/components/landing/landing";

export const metadata: Metadata = {
  title: "Find companies ready to buy from you this week",
  description: "Paste your website. Outmax finds companies that fit your ideal customer, checks each one against real sources, and gives you the decision-maker, their email and three drafts to send. Your first 10 leads are free.",
  openGraph: {
    title: "Outmax · Find companies ready to buy from you this week",
    description: "Checked leads with proof of fit, the decision-maker at each, and email drafts. First 10 free.",
    type: "website",
  },
};

export default function Page() {
  return <Landing />;
}
