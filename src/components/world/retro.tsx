"use client";

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

// The overlay's UI kit, after a classic early-2000s desktop: light grey bevelled windows, a slim title bar with three
// tiny coloured control boxes (yellow, purple, red), white sunken fields, raised grey buttons, and a taskbar. The
// active window's title bar is yellow; accents stay in the navy / yellow / light-blue palette.

export const uiFont = "font-sans";

export const INK = "#1b1d22";
export const NAVY = "#1d2f5a";
export const FACE = "#dedcd6"; // window grey

/** Raised bevel (windows, buttons). */
export const raised: CSSProperties = {
  boxShadow: "inset -1px -1px 0 #3a3a3a, inset 1px 1px 0 #ffffff, inset -2px -2px 0 #8f8d88, inset 2px 2px 0 #f4f3ef",
};
/** Sunken bevel (text fields, lists). */
export const sunken: CSSProperties = {
  boxShadow: "inset 1px 1px 0 #8f8d88, inset -1px -1px 0 #ffffff, inset 2px 2px 0 #3a3a3a, inset -2px -2px 0 #e9e8e4",
};

const TITLE = {
  active: { background: "linear-gradient(90deg, #e8a93b, #f6d47c)", color: INK },
  plain: { background: "linear-gradient(90deg, #b9b7b1, #e4e2dc)", color: INK },
  navy: { background: `linear-gradient(90deg, ${NAVY}, #8fa6cf)`, color: "#fff" },
};

function ControlBoxes() {
  return (
    <span className="flex shrink-0 gap-[3px]" aria-hidden>
      {["#f2c94c", "#9b6bd0", "#d9534f"].map((c) => (
        <span key={c} className="h-[11px] w-[11px] border border-[#3a3a3a]" style={{ background: c, boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.55)" }} />
      ))}
    </span>
  );
}

/** A desktop window: bevelled frame, a slim title bar with an icon, and a body. */
export function Panel({
  title,
  icon,
  tone = "plain",
  body = "face",
  className = "",
  children,
}: {
  title: string;
  icon?: ReactNode;
  tone?: keyof typeof TITLE;
  body?: "face" | "navy";
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex min-h-0 flex-col p-[4px] shadow-[3px_4px_0_rgba(20,25,40,0.22)] ${uiFont} ${className}`}
      style={{ background: FACE, ...raised }}
    >
      <header className="flex h-[22px] shrink-0 items-center gap-1.5 px-1.5 text-[13px] font-bold" style={TITLE[tone]}>
        {icon}
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <ControlBoxes />
      </header>
      <div className={`mt-[3px] flex min-h-0 flex-1 flex-col ${body === "navy" ? "bg-[#13233f]" : ""}`}>{children}</div>
    </section>
  );
}

/** A raised grey button (or the yellow default button). */
export function NavButton({
  tone = "plain",
  icon,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "plain" | "yellow" | "navy"; icon?: ReactNode }) {
  const tones = { plain: "bg-[#e9e7e1] text-[#1b1d22]", yellow: "bg-[#f2c94c] text-[#1b1d22]", navy: "bg-[#1d2f5a] text-white" };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1 text-[13px] font-bold transition-[filter] hover:brightness-[1.04] active:[box-shadow:inset_1px_1px_0_#3a3a3a,inset_-1px_-1px_0_#fff] disabled:text-[#8f8d88] disabled:hover:brightness-100 ${uiFont} ${tones[tone]} ${className}`}
      style={raised}
    >
      {icon}
      {children}
    </button>
  );
}

/** A small framed chick, like the character portraits in the old chat windows. */
export function ChickIcon({ tone = "yellow", size = 16 }: { tone?: "yellow" | "blue"; size?: number }) {
  const [light, mid, dark] = tone === "yellow" ? ["#fbeaa0", "#e2c454", "#a98d2c"] : ["#e9f3fc", "#a9c8e6", "#5f86ad"];
  const id = `chick-${tone}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <defs>
        <radialGradient id={id} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor={light} />
          <stop offset="0.6" stopColor={mid} />
          <stop offset="1" stopColor={dark} />
        </radialGradient>
      </defs>
      <ellipse cx="16" cy="17.5" rx="12" ry="13" fill={`url(#${id})`} />
      <path d="M8.5 15 q3 -1.6 6 0 M17.5 15 q3 -1.6 6 0" stroke={dark} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="11.6" cy="16.6" r="1.1" fill={INK} />
      <circle cx="20.4" cy="16.6" r="1.1" fill={INK} />
      <path d="M14.2 19.4 L17.8 19.4 L16 22 Z" fill="#d98e5c" />
    </svg>
  );
}

/** A framed portrait square, like the avatar boxes in the reference windows. */
export function Portrait({ tone = "yellow", size = 52 }: { tone?: "yellow" | "blue"; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center bg-[#9fa8b8]" style={{ width: size, height: size, ...sunken }}>
      <ChickIcon tone={tone} size={size * 0.72} />
    </span>
  );
}

/** The wordmark: plain and bold, with the chick as its icon. */
export function Logo({ size = 16 }: { size?: number }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-bold tracking-tight text-[#1b1d22] ${uiFont}`} style={{ fontSize: size }}>
      <ChickIcon size={size * 1.15} />
      extraview
    </span>
  );
}
