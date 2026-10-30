import Image from "next/image";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Small shared building blocks so every page looks like the same product. */

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-teal-600 text-white shadow-sm hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none",
  secondary: "bg-white text-slate-700 ring-1 ring-slate-200 shadow-sm hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40",
  danger: "bg-white text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50",
};

const SIZES = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function buttonClass(variant: Variant = "secondary", size: keyof typeof SIZES = "md", extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  size?: keyof typeof SIZES;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl bg-white ring-1 ring-slate-200 ${className}`}>{children}</div>;
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{children}</h2>
      {hint && <p className="text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

/** Pick-one control for a small set of options, each with an optional description. */
export function Choice<T extends string>({
  value,
  options,
  onChange,
  columns = 3,
}: {
  value: T;
  options: { value: T; label: string; description?: string }[];
  onChange: (value: T) => void;
  columns?: 2 | 3 | 5;
}) {
  const grid = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 5: "grid-cols-5" }[columns];
  return (
    <div role="radiogroup" className={`grid gap-2 ${grid}`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`rounded-xl px-3 py-2.5 text-left text-sm transition ${
              active ? "bg-teal-50 text-teal-900 ring-2 ring-teal-500" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            <span className="block font-medium">{option.label}</span>
            {option.description && <span className="mt-0.5 block text-xs text-slate-500">{option.description}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight text-slate-900">
      <Image src="/design/logo/pip-badge.png" alt="" width={28} height={28} className="h-7 w-7 rounded-full" />
      Pip
    </Link>
  );
}
