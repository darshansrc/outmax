"use client";

import { useState } from "react";
import { countries } from "country-flag-icons";
import { Globe } from "lucide-react";
import { cn } from "cn";

export function Favicon({ url, className = "size-4" }: { url?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  const domain = domainOf(url);
  if (!domain || failed) {
    return <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center text-zinc-300", className)}><Globe className="size-[85%]" strokeWidth={1.75} /></span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`} alt="" aria-hidden loading="lazy"
      onError={() => setFailed(true)}
      onLoad={(event) => { if (event.currentTarget.naturalWidth <= 16) setFailed(true); }}
      className={cn("shrink-0 rounded-[3px] object-contain", className)}
    />
  );
}

export function Flag({ location, className = "h-3 w-[18px]" }: { location?: string | null; className?: string }) {
  const code = countryCode(location);
  if (!code) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/flags/${code}.svg`} alt="" aria-hidden className={cn("shrink-0 rounded-[2px] object-cover ring-1 ring-zinc-950/10", className)} />
  );
}

export function LinkedInLogo({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("shrink-0", className)}>
      <path fill="#0A66C2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.063 2.063 0 1 1 0-4.126 2.063 2.063 0 0 1 0 4.126zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function domainOf(url?: string | null) {
  if (!url) return null;
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const aliases: Record<string, string> = {
  uk: "GB", "great britain": "GB", england: "GB", scotland: "GB", wales: "GB", "northern ireland": "GB",
  us: "US", usa: "US", "united states of america": "US", america: "US",
  uae: "AE", "czech republic": "CZ", russia: "RU", "russian federation": "RU", korea: "KR", "republic of korea": "KR",
  turkey: "TR", holland: "NL", "hong kong": "HK", macau: "MO", "ivory coast": "CI", vietnam: "VN", bosnia: "BA",
  macedonia: "MK", "the netherlands": "NL", "the bahamas": "BS", "the gambia": "GM", "cape verde": "CV", swaziland: "SZ",
  burma: "MM", "dr congo": "CD", "democratic republic of the congo": "CD", "republic of the congo": "CG", palestine: "PS",
};

const usStates = new Set(
  "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" "),
);

let names: Map<string, string> | null = null;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.()]/g, "").replace(/\s+/g, " ").trim();
}

function countryNames() {
  if (names) return names;
  names = new Map(Object.entries(aliases));
  const display = new Intl.DisplayNames(["en"], { type: "region" });
  for (const code of countries) {
    if (code.length !== 2) continue;
    const name = display.of(code);
    if (name && name !== code) {
      names.set(normalize(name), code);
      names.set(normalize(name.replace(/ SAR China$/, "")), code);
    }
  }
  return names;
}

export function countryCode(location?: string | null) {
  if (!location) return null;
  const parts = location.replace(/\(.*?\)/g, "").split(/[,;·|/]| and /).map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    const code = countryNames().get(normalize(part));
    if (code) return code;
    if (usStates.has(part)) return "US";
  }
  return null;
}
