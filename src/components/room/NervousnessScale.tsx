"use client";

import { NERVOUSNESS_LABELS } from "@/lib/history";

/** 1 (calm) to 5 (overwhelmed). Tracking it before and after shows whether practice is helping. */
export function NervousnessScale({ value, onChange, label }: { value?: number; onChange: (value: number) => void; label: string }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-800">{label}</legend>
      <div className="grid grid-cols-5 gap-1.5">
        {NERVOUSNESS_LABELS.map((text, i) => {
          const level = i + 1;
          const active = value === level;
          return (
            <button
              key={level}
              type="button"
              onClick={() => onChange(level)}
              aria-pressed={active}
              className={`rounded-xl px-1 py-2 text-xs leading-tight transition ${
                active ? "bg-teal-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className="block text-base font-semibold">{level}</span>
              {text}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
