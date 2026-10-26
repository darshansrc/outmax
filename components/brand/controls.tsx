import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "cn";

/**
 * Controls for the marketing site, account screens, and new pages.
 * Primary is the black action. Secondary is the bordered action. Ghost is a quiet
 * text action. Text is an inline action with no fixed height.
 */

type Variant = "primary" | "secondary" | "ghost" | "text";
type Size = "sm" | "md";

const base =
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium tracking-[-0.01em] whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0";

const variants: Record<Variant, string> = {
  primary: "bg-zinc-950 text-white hover:bg-zinc-800",
  secondary: "border border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-50",
  ghost: "text-zinc-700 hover:text-zinc-950",
  text: "text-[14px] text-zinc-700 hover:text-zinc-950",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[14px]",
  md: "h-11 px-5 text-[15px]",
};

export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(base, variants[variant], variant === "text" ? "h-auto px-0" : sizes[size], className);
}

type StyleProps = { variant?: Variant; size?: Size; className?: string; children?: ReactNode };
type ButtonProps = StyleProps & Omit<ComponentProps<"button">, "className" | "children"> & { href?: undefined };
type LinkProps = StyleProps & Omit<ComponentProps<"a">, "className" | "children" | "href"> & { href: string };

export function Button({ variant = "primary", size = "md", className, href, children, ...props }: ButtonProps | LinkProps) {
  const classes = buttonClassName({ variant, size, className });
  if (typeof href === "string") {
    if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return <a href={href} className={classes} {...(props as ComponentProps<"a">)}>{children}</a>;
    }
    return <Link href={href} className={classes} {...(props as Omit<ComponentProps<typeof Link>, "href" | "className" | "children">)}>{children}</Link>;
  }
  return <button className={classes} {...(props as ComponentProps<"button">)}>{children}</button>;
}

const field =
  "w-full min-w-0 rounded-lg border border-zinc-300 bg-white text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-950 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-red-400";

const fieldSizes: Record<Size, string> = {
  sm: "h-9 px-3 text-[14px]",
  md: "h-11 px-3.5 text-[15px]",
};

export function Input({ className, size = "md", ...props }: Omit<ComponentProps<"input">, "size"> & { size?: Size }) {
  return <input className={cn(field, fieldSizes[size], className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(field, "min-h-20 resize-y px-3 py-2 text-[14px] leading-6", className)} {...props} />;
}

export function TagInput({ id, value, onChange, placeholder, className }: {
  id?: string; value: string[]; onChange: (value: string[]) => void; placeholder?: string; className?: string;
}) {
  function add(raw: string) {
    const next = raw.split(",").map((item) => item.trim()).filter(Boolean)
      .filter((item) => !value.some((existing) => existing.toLowerCase() === item.toLowerCase()));
    if (next.length) onChange([...value, ...next]);
  }
  return (
    <div className={cn(field, "flex min-h-9 flex-wrap items-center gap-1.5 px-2 py-1.5 focus-within:border-zinc-950", className)}>
      {value.map((item) => (
        <span key={item} className="inline-flex max-w-full min-h-6 items-center gap-1 rounded-md bg-zinc-100 py-0.5 pr-1 pl-2 text-[13px] leading-5 text-zinc-800">
          <span className="min-w-0 break-words">{item}</span>
          <button
            type="button" aria-label={`Remove ${item}`} onClick={() => onChange(value.filter((existing) => existing !== item))}
            className="inline-flex size-4 shrink-0 items-center justify-center rounded text-zinc-500 hover:bg-zinc-200 hover:text-zinc-950"
          >
            <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden><path d="M2 2l6 6M8 2 2 8" stroke="currentColor" strokeWidth="1.4" /></svg>
          </button>
        </span>
      ))}
      <input
        id={id}
        placeholder={value.length ? "Add more" : placeholder}
        className="h-6 min-w-[8rem] flex-1 bg-transparent px-1 text-[14px] outline-none placeholder:text-zinc-400"
        onKeyDown={(event) => {
          const input = event.currentTarget;
          if ((event.key === "Enter" || event.key === ",") && input.value.trim()) {
            event.preventDefault();
            add(input.value);
            input.value = "";
          } else if (event.key === "Backspace" && !input.value && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={(event) => {
          add(event.currentTarget.value);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-[13px] font-medium text-zinc-800", className)} {...props} />;
}

export function FieldMessage({ id, error, children }: { id?: string; error?: boolean; children: ReactNode }) {
  return (
    <p id={id} role={error ? "alert" : undefined} className={cn("mt-2 text-[13px]", error ? "text-red-600" : "text-zinc-600")}>
      {children}
    </p>
  );
}

/** The joined website field: border and focus live on the group, not the input. */
export function inputGroupClassName(invalid: boolean) {
  return cn(
    "flex h-12 overflow-hidden rounded-lg border bg-white shadow-[0_1px_2px_rgba(9,9,11,0.06)] transition-colors focus-within:border-zinc-950",
    invalid ? "border-red-400" : "border-zinc-300",
  );
}

export const bareInputClassName = "h-full min-w-0 flex-1 bg-transparent text-[15px] text-zinc-950 outline-none placeholder:text-zinc-500";
