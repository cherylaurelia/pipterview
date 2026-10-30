"use client";

import Image from "next/image";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

// The overlay's UI kit, in the style of a cozy game's interface: soft cream cards with rounded corners and gentle
// shadows, pill-shaped buttons (a warm yellow one for the main action on each screen), and inset fields. Kept
// deliberately plain: no window chrome, so nothing looks like it needs managing.

export const uiFont = "font-sans";

export const INK = "#3d2a1c";
export const NAVY = "#2f4a7a";
export const FACE = "#fff8ec"; // card cream

/** A soft lift, for small floating things (badges, banners). */
export const raised: CSSProperties = {
  borderRadius: 14,
  boxShadow: "0 4px 14px rgba(90, 60, 30, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.85)",
};
/** An inset field (text boxes, lists, the editor). */
export const sunken: CSSProperties = {
  borderRadius: 12,
  boxShadow: "inset 0 1px 3px rgba(90, 60, 30, 0.14), inset 0 0 0 1px rgba(214, 186, 146, 0.45)",
};

/** A card: a soft rounded panel with a small heading. (`tone` is accepted for older call sites and ignored.) */
export function Panel({
  title,
  icon,
  body = "face",
  className = "",
  children,
}: {
  title: string;
  icon?: ReactNode;
  tone?: "active" | "plain" | "navy";
  body?: "face" | "navy";
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex min-h-0 flex-col rounded-[20px] bg-[#fff8ec]/95 p-2.5 shadow-[0_12px_32px_rgba(70,45,20,0.2)] ring-1 ring-[#f0dfc2] backdrop-blur ${uiFont} ${className}`}
    >
      <header className="flex shrink-0 items-center gap-2 px-1.5 pt-0.5 pb-1.5 text-[15px] font-bold text-[#4a3424]">
        {icon}
        <span className="min-w-0 flex-1 truncate">{title}</span>
      </header>
      <div className={`flex min-h-0 flex-1 flex-col ${body === "navy" ? "overflow-hidden rounded-xl bg-[#13233f]" : ""}`}>{children}</div>
    </section>
  );
}

/** A pill button: white for secondary actions, warm yellow for the one main action on a screen. */
export function NavButton({
  tone = "plain",
  icon,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "plain" | "yellow" | "navy"; icon?: ReactNode }) {
  const tones = {
    plain: "bg-white text-[#4a3424] ring-1 ring-[#ead7b8] hover:bg-[#fff4df]",
    yellow: "bg-[#ffc95c] text-[#3d2a14] shadow-[0_2px_0_#e0a43a] hover:bg-[#ffd16f]",
    navy: "bg-[#3b5b8f] text-white hover:bg-[#45689f]",
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-[14px] font-bold transition-colors active:translate-y-px disabled:cursor-default disabled:opacity-45 ${uiFont} ${tones[tone]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

/** A small chick, matching the one in the world: comb, dot eyes, beak and wattle, rosy cheeks. */
export function ChickIcon({ tone = "yellow", size = 16 }: { tone?: "yellow" | "blue"; size?: number }) {
  const [light, mid, dark] = tone === "yellow" ? ["#fdf0b8", "#f6d77a", "#d9b14e"] : ["#e9f3fc", "#a9c8e6", "#5f86ad"];
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
      <circle cx="14" cy="5.6" r="2" fill="#e5564a" />
      <circle cx="16.4" cy="4.6" r="2.4" fill="#e5564a" />
      <circle cx="18.8" cy="5.8" r="1.9" fill="#e5564a" />
      <path d="M16 6 C22 6 24.5 11 25.5 16.5 C27 23 24 30 16 30 C8 30 5 23 6.5 16.5 C7.5 11 10 6 16 6 Z" fill={`url(#${id})`} />
      <ellipse cx="10.4" cy="17.4" rx="1.9" ry="1.1" fill="#ff9a94" opacity="0.65" />
      <ellipse cx="21.6" cy="17.4" rx="1.9" ry="1.1" fill="#ff9a94" opacity="0.65" />
      <circle cx="12.6" cy="14.4" r="1.15" fill="#241a16" />
      <circle cx="19.4" cy="14.4" r="1.15" fill="#241a16" />
      <path d="M14.4 16.2 L17.6 16.2 L16 18.6 Z" fill="#f39a4f" />
      <ellipse cx="16" cy="20" rx="1.1" ry="1.5" fill="#e5564a" />
    </svg>
  );
}

/** Pip in a soft round badge. */
export function Portrait({ size = 52 }: { size?: number }) {
  return (
    <span className="block shrink-0 overflow-hidden rounded-full ring-2 ring-white" style={{ width: size, height: size }}>
      <Image src="/design/logo/pip-badge.png" alt="" width={size} height={size} className="h-full w-full" />
    </span>
  );
}

/** The full Pip logo (the chick and its lettering), for the welcome card. */
export function PipLogo({ size = 76 }: { size?: number }) {
  return <Image src="/design/logo/pip-logo.png" alt="Pip" width={size} height={size} priority className="shrink-0" style={{ width: size, height: size }} />;
}

/** The wordmark, with the chick as its icon. */
export function Logo({ size = 16 }: { size?: number }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-bold tracking-tight text-[#4a3424] ${uiFont}`} style={{ fontSize: size }}>
      <ChickIcon size={size * 1.15} />
      Pip
    </span>
  );
}
