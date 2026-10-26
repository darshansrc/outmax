"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "cn";
import { buttonClassName } from "@/components/brand/controls";
import { ENGINE_LABELS, ENGINES, type Engine } from "@/lib/onboarding";
import { Spinner } from "./shell";

export const ENGINE_NOTES: Record<Engine, string> = {
  outmax: "Searches the web, checks each company against your must-haves, then finds the decision-maker. About 5 minutes.",
  exa: "One Exa research run with Fiber contacts. 5–10 minutes.",
};

/** Submit button for the profile form, with a menu to pick the search engine. */
export function EngineButton({ engine, onEngine, pending, form, className }: {
  engine: Engine; onEngine: (engine: Engine) => void; pending: boolean; form: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={root} className={cn("relative flex", className)}>
      <button type="submit" form={form} disabled={pending} className={buttonClassName({ size: "sm", className: "min-w-0 flex-1 rounded-r-none" })}>
        {pending ? <><Spinner className="size-3 border-zinc-600 border-t-white" />Starting…</> : "Find leads"}
      </button>
      <button
        type="button"
        disabled={pending}
        aria-label={`Search engine: ${ENGINE_LABELS[engine]}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={buttonClassName({ size: "sm", className: "rounded-l-none border-l border-zinc-700 px-2.5" })}
      >
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div id={menuId} role="menu" className="absolute top-full right-0 left-0 z-20 mt-1 rounded-lg border border-zinc-200 bg-white p-1">
          {ENGINES.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === engine}
              onClick={() => {
                onEngine(option);
                setOpen(false);
              }}
              className="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none"
            >
              <Check className={cn("mt-0.5 size-3.5 shrink-0", option === engine ? "text-zinc-950" : "invisible")} />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-zinc-950">
                  {ENGINE_LABELS[option]}
                  {option === "outmax" && <span className="ml-1.5 font-normal text-zinc-500">Default</span>}
                </span>
                <span className="mt-0.5 block text-[12px] leading-[17px] text-zinc-500">{ENGINE_NOTES[option]}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
