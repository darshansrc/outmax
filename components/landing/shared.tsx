export const grain = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const lattice = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='176' height='176'%3E%3Cg fill='none' stroke='white' stroke-opacity='.22'%3E%3Cpath d='M0 88 88 0l88 88-88 88z'/%3E%3Cpath d='M44 88 88 44l44 44-44 44z' stroke-opacity='.12'/%3E%3C/g%3E%3C/svg%3E")`;

export const panelTones = {
  blue: "bg-[#3448d6]",
  magenta: "bg-[#b0278f]",
  amber: "bg-[#e0892b]",
} as const;

export function LatticePanel({ tone, className = "", children }: { tone: keyof typeof panelTones; className?: string; children: React.ReactNode }) {
  return (
    <div className={`relative overflow-hidden transition-colors duration-700 ${panelTones[tone]} ${className}`}>
      <div aria-hidden className="absolute inset-0 bg-size-[176px_176px] bg-position-[center_-20px]" style={{ backgroundImage: lattice }} />
      <div aria-hidden className="absolute inset-0 opacity-[0.22] mix-blend-overlay" style={{ backgroundImage: grain }} />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

export function Plus({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden className={`pointer-events-none absolute size-2.5 text-[#b3277d] ${className}`}>
      <path d="M5 0v10M0 5h10" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function Hatch() {
  return (
    <div
      aria-hidden
      className="h-4 border-t border-zinc-200"
      style={{ backgroundImage: "repeating-linear-gradient(45deg, #e4e4e7 0 1px, transparent 1px 8px), repeating-linear-gradient(-45deg, #e4e4e7 0 1px, transparent 1px 8px)" }}
    />
  );
}

export function Connector() {
  return (
    <div aria-hidden className="relative h-11">
      <div className="absolute inset-x-0 top-1/2 h-px bg-zinc-200" />
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-zinc-200" />
      <div className="absolute top-1/2 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-zinc-300 bg-[#f7f7f8]" />
    </div>
  );
}

export function Box({ id, className = "", children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={`relative mx-auto w-full max-w-[1080px] scroll-mt-20 border-y border-zinc-200 bg-[#fcfcfc] sm:border-x ${className}`}>
      {children}
    </section>
  );
}