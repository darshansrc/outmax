"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Check } from "lucide-react";
import { Button, FieldMessage, Input, Label } from "@/components/brand/controls";
import { Emblem, Wordmark } from "@/components/brand/logo";
import { LatticePanel } from "@/components/landing/shared";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const freeInboxes = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "msn.com",
  "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "mail.com", "yandex.com", "zoho.com",
]);

type Step = "start" | "code" | "name";

export function AuthScreen({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const signup = mode === "signup";
  const [step, setStep] = useState<Step>("start");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    const domain = value.split("@")[1] ?? "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter your work email, like you@company.com");
      return;
    }
    if (freeInboxes.has(domain)) {
      setError("Use your work email, not a personal inbox");
      return;
    }
    setEmail(value);
    setError(null);
    setStep("code");
  }

  function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length < 6) {
      setError("Enter the 6-digit code");
      return;
    }
    setError(null);
    if (signup) setStep("name");
    else router.push("/onboarding");
  }

  function submitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!first.trim() || !last.trim()) {
      setError("Enter your first and last name");
      return;
    }
    setError(null);
    router.push("/onboarding");
  }

  return (
    <div className="grid min-h-dvh bg-white font-sans text-zinc-950 antialiased lg:grid-cols-2">
      <div className="flex min-h-dvh flex-col px-6 sm:px-10">
        <header className="flex items-center justify-between py-5">
          <Wordmark className="text-zinc-950" />
          <Button href={signup ? "/login" : "/signup"} variant="secondary" size="sm" className="rounded-full px-3.5 text-[13px]">
            {signup ? "Log in" : "Create a new account"}
          </Button>
        </header>

        <div className="flex flex-1 items-center py-8">
          <div className="mx-auto w-full max-w-[420px]">
            {step === "start" && (
              <div>
                <h1 className="text-[32px] leading-[1.15] font-medium tracking-[-0.03em]">
                  {signup ? "Create your account" : "Welcome back"}
                </h1>
                <p className="mt-2 text-[15px] leading-6 text-zinc-600">
                  {signup ? "Start with Google, or use your work email." : "Log in with Google, or use your work email."}
                </p>

                <Button type="button" variant="secondary" className="mt-8 w-full">
                  <GoogleMark />
                  Continue with Google
                </Button>

                <div className="my-5 flex items-center gap-3 text-[12px] font-medium tracking-[0.14em] text-zinc-500">
                  <span className="h-px flex-1 bg-zinc-200" />
                  OR
                  <span className="h-px flex-1 bg-zinc-200" />
                </div>

                <form onSubmit={submitEmail} noValidate>
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email" name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                    value={email} onChange={(event) => { setEmail(event.target.value); setError(null); }}
                    placeholder="you@company.com" aria-invalid={!!error} aria-describedby="email-note"
                    className="mt-1.5"
                  />
                  <FieldMessage id="email-note" error={!!error}>
                    {error ?? "Personal inboxes like Gmail aren’t accepted"}
                  </FieldMessage>
                  <Button type="submit" className="mt-4 w-full">Continue</Button>
                </form>
              </div>
            )}

            {step === "code" && (
              <form onSubmit={submitCode} noValidate>
                <h1 className="text-[32px] leading-[1.15] font-medium tracking-[-0.03em]">Enter your code</h1>
                <p className="mt-2 text-[15px] leading-6 text-zinc-600">6-digit code for <span className="font-medium text-zinc-950">{email}</span></p>
                <InputOTP
                  maxLength={6} pattern={REGEXP_ONLY_DIGITS} value={code} inputMode="numeric" autoComplete="one-time-code"
                  onChange={(value) => { setCode(value); setError(null); }} containerClassName="mt-8"
                  aria-invalid={!!error} aria-describedby="code-note"
                >
                  <InputOTPGroup className="gap-2">
                    {Array.from({ length: 6 }, (_, index) => (
                      <InputOTPSlot key={index} index={index} className="size-11 rounded-lg border border-zinc-300 text-[18px] font-medium text-zinc-950 first:rounded-lg first:border last:rounded-lg data-[active=true]:border-zinc-950 data-[active=true]:ring-0 sm:size-12" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <p id="code-note" role={error ? "alert" : undefined} className={`mt-3 text-[13px] ${error ? "text-red-600" : "text-zinc-600"}`}>
                  {error ?? "Check your inbox and spam folder"}
                </p>
                <Button type="submit" className="mt-6 w-full">Continue</Button>
                <Button type="button" variant="text" onClick={() => { setStep("start"); setCode(""); setError(null); }} className="mt-4">
                  Use a different email
                </Button>
              </form>
            )}

            {step === "name" && (
              <form onSubmit={submitName} noValidate>
                <h1 className="text-[32px] leading-[1.15] font-medium tracking-[-0.03em]">What’s your name?</h1>
                <p className="mt-2 text-[15px] leading-6 text-zinc-600">This is how you’ll appear on your account.</p>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <Field id="given-name" name="given-name" label="First name" autoComplete="given-name" value={first} onChange={setFirst} invalid={!!error} />
                  <Field id="family-name" name="family-name" label="Last name" autoComplete="family-name" value={last} onChange={setLast} invalid={!!error} />
                </div>
                <p role={error ? "alert" : undefined} className="mt-2 min-h-5 text-[13px] text-red-600">{error}</p>
                <Button type="submit" className="w-full">Create account</Button>
              </form>
            )}
          </div>
        </div>

        <footer className="py-5 text-[13px] text-zinc-500">© 2026 Outmax</footer>
      </div>

      <ProductPanel />
    </div>
  );
}

const leads = [
  { company: "Hartwell & Pryce LLP", reason: "BD team writes the Chambers submission", email: "Verified" },
  { company: "Ostrander Vale", reason: "Hiring a Directories & Awards Manager", email: "Unverified" },
  { company: "Maddox Kerr", reason: "Ranked in 14 Legal 500 practice areas", email: "Verified" },
];

function ProductPanel() {
  return (
    <aside className="hidden lg:block" aria-label="What a search looks like">
      <LatticePanel tone="blue" className="min-h-dvh">
        <div className="flex min-h-dvh flex-col items-center justify-center px-10 py-12 xl:px-16">
          <div className="w-full max-w-[440px]">
            <div className="flex justify-end pr-3">
              <div className="w-[230px] rounded-2xl bg-white p-4 shadow-[0_18px_40px_-16px_rgba(9,9,11,0.4)]">
                <p className="text-[10px] font-semibold tracking-[0.16em] text-[#3448d6]">WHY THEY FIT</p>
                <p className="mt-2 text-[14px] leading-5 font-medium text-zinc-950">Hiring a Directories & Awards Manager</p>
                <p className="mt-2 text-[12px] text-zinc-500">ostrandervale.co.uk · job post</p>
              </div>
            </div>

            <div className="relative z-10 -mt-7 rounded-2xl bg-white p-3 shadow-[0_30px_70px_-24px_rgba(9,9,11,0.55)]">
              <div className="flex items-center justify-between gap-3 px-2 py-2">
                <div className="flex min-w-0 items-center gap-2 text-[13px] font-medium">
                  <Emblem className="size-4 shrink-0" />
                  <span className="truncate">rankingcopilot.com</span>
                </div>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">Sample search</span>
              </div>
              <ul className="overflow-hidden rounded-xl border border-zinc-200">
                {leads.map((lead) => (
                  <li key={lead.company} className="flex items-center justify-between gap-3 border-b border-zinc-100 px-3 py-3.5 last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-zinc-950">{lead.company}</p>
                      <p className="truncate text-[12px] text-zinc-500">{lead.reason}</p>
                    </div>
                    <span className={`shrink-0 text-[12px] font-medium ${lead.email === "Verified" ? "text-emerald-700" : "text-zinc-500"}`}>
                      {lead.email === "Verified" && <Check className="mr-1 inline size-3.5 align-[-2px]" strokeWidth={2.5} />}
                      {lead.email}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative z-20 -mt-5 ml-3 w-[248px] rounded-2xl bg-white p-4 shadow-[0_18px_40px_-16px_rgba(9,9,11,0.4)]">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-[#3448d6]">DECISION-MAKER</p>
              <p className="mt-2 text-[15px] font-medium text-zinc-950">Eleanor Shaw</p>
              <p className="text-[13px] text-zinc-600">Head of Business Development</p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
                <Check className="size-3.5" strokeWidth={2.5} />
                e.shaw@hartwellpryce.com
              </p>
            </div>
          </div>

          <p className="mt-12 max-w-sm text-center text-[15px] leading-6 text-white/90">
            The company, the buyer, the source, and an email that was checked.
          </p>
        </div>
      </LatticePanel>
    </aside>
  );
}

function Field({ id, name, label, autoComplete, value, onChange, invalid }: {
  id: string; name: string; label: string; autoComplete: string; value: string; onChange: (value: string) => void; invalid: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id} name={name} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid} className="mt-1.5"
      />
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-4.5" aria-hidden>
      <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" />
      <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.6-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z" />
      <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3L15 2.3A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
    </svg>
  );
}
