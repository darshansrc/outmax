"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Globe } from "lucide-react";
import { bareInputClassName, buttonClassName, inputGroupClassName } from "@/components/brand/controls";
import { onboardingUrlForSite } from "./research-url";

export function SiteForm({ center, onColor, id = "url" }: { center?: boolean; onColor?: boolean; id?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = onboardingUrlForSite(String(new FormData(event.currentTarget).get("url") ?? ""));
    if (!url) {
      setError("Enter your company website, like acme.com");
      return;
    }
    setPending(true);
    router.push(url);
  }

  return (
    <form onSubmit={submit} noValidate className={`w-full max-w-[420px] ${center ? "mx-auto" : ""}`}>
      <div className={inputGroupClassName(!!error)}>
        <label htmlFor={id} className="flex min-w-0 flex-1 items-center gap-2 px-3">
          <Globe className="size-4 shrink-0 text-zinc-500" strokeWidth={1.75} />
          <span className="sr-only">Your company website</span>
          <input
            id={id} name="url" type="url" inputMode="url" autoComplete="url" autoCapitalize="off" autoCorrect="off" spellCheck={false}
            onInput={() => setError(null)}
            placeholder="yourcompany.com" aria-invalid={!!error} aria-describedby={`${id}-note`}
            className={bareInputClassName}
          />
        </label>
        <button type="submit" disabled={pending}
          className={buttonClassName({ className: "group h-full gap-1 rounded-none px-3.5 text-[14px] sm:gap-1.5 sm:px-5 sm:text-[15px]" })}>
          {pending ? "Opening…" : "Get my free leads"}
          {!pending && (
            <ChevronRight className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-1 group-active:translate-x-1.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" strokeWidth={2} />
          )}
        </button>
      </div>
      <p id={`${id}-note`} role={error ? "alert" : undefined} className={`mt-3 text-[13px] ${center ? "text-center" : ""} ${error ? (onColor ? "font-medium text-white" : "text-red-600") : (onColor ? "text-white/90" : "text-zinc-600")}`}>
        {error ?? "10 free leads · Email drafts included · No credit card"}
      </p>
    </form>
  );
}
