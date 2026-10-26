import Link from "next/link";
import { Hanken_Grotesk } from "next/font/google";

export const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken" });

export function Emblem({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10.5" />
      <circle cx="13.2" cy="10.8" r="6.6" />
      <circle cx="14.2" cy="9.8" r="3.2" />
      <circle cx="14.6" cy="9.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" aria-label="Outmax home" className={`flex items-center gap-2.5 ${className}`}>
      <Emblem />
      <span className={`${hanken.className} text-[13px] font-[520] tracking-[0.2em]`}>OUTMAX</span>
    </Link>
  );
}
